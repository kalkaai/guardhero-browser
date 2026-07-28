#!/usr/bin/env bash
# Guard Hero — C++ Unit Test Runner
# Compiles and runs EagleEye unit tests without needing a full Chromium build.
#
# Requirements:
#   macOS:  brew install googletest
#   Linux:  sudo apt install libgtest-dev cmake  (then build gtest manually if needed)
#
# Usage:
#   ./tests/run_cpp_tests.sh              # run all tests
#   ./tests/run_cpp_tests.sh domain       # run only domain_matcher tests
#   ./tests/run_cpp_tests.sh url          # run only url_analyzer tests

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$REPO_ROOT/.cpp-test-build"
PASS=0
FAIL=0
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo -e "${CYAN}Guard Hero — EagleEye C++ Unit Tests${RESET}"
echo "────────────────────────────────────"

# ── Detect platform & set compiler flags ─────────────────────────────────────
# The Guard Hero gtest stub at /tmp/gtest-stub is header-only (main() is
# embedded). When it's present, no -lgtest linkage is needed or wanted.
# Only fall back to system/installed gtest if the stub isn't available.

GTEST_STUB_DIR="/tmp/gtest-stub"

if [[ -f "${GTEST_STUB_DIR}/testing/gtest/include/gtest/gtest.h" ]]; then
  # Header-only stub — no library to link
  GTEST_INCLUDE=""
  GTEST_LIBS=""
elif [[ "$OSTYPE" == "darwin"* ]]; then
  GTEST_PREFIX="$(brew --prefix googletest 2>/dev/null || echo /usr/local)"
  GTEST_INCLUDE="-I${GTEST_PREFIX}/include"
  GTEST_LIBS="-L${GTEST_PREFIX}/lib -lgtest -lgtest_main"
else
  # Linux — try system gtest, then build from source
  if pkg-config --exists gtest 2>/dev/null; then
    GTEST_INCLUDE="$(pkg-config --cflags gtest)"
    GTEST_LIBS="$(pkg-config --libs gtest) -lgtest_main"
  elif [ -d /usr/src/gtest ]; then
    echo "Building gtest from source..."
    cmake -S /usr/src/gtest -B /tmp/gtest-build -DCMAKE_BUILD_TYPE=Release > /dev/null 2>&1
    cmake --build /tmp/gtest-build > /dev/null 2>&1
    GTEST_LIBS="/tmp/gtest-build/lib/libgtest.a /tmp/gtest-build/lib/libgtest_main.a"
    GTEST_INCLUDE="-I/usr/src/googletest/googletest/include"
  else
    GTEST_INCLUDE=""
    GTEST_LIBS="-lgtest -lgtest_main"
  fi
fi

CXX_FLAGS="-std=c++17 -O2 -Wall -Wno-unused-variable"
# Include the gtest stub path so tests can find testing/gtest/include/gtest/gtest.h
GTEST_STUB_DIR="/tmp/gtest-stub"
INCLUDES="-I${REPO_ROOT} -I${REPO_ROOT}/eagleeye-native -I${GTEST_STUB_DIR} ${GTEST_INCLUDE}"

mkdir -p "$BUILD_DIR"

# ── Helper: compile and run one test binary ───────────────────────────────────
run_test() {
  local name="$1"
  local test_src="$2"
  local impl_srcs="${@:3}"
  local binary="$BUILD_DIR/${name}_test"

  echo -e "\n${CYAN}▶ Compiling ${name} tests...${RESET}"

  if g++ $CXX_FLAGS $INCLUDES \
       "$test_src" $impl_srcs \
       $GTEST_LIBS -pthread \
       -o "$binary" 2>&1; then
    echo -e "${CYAN}▶ Running ${name} tests...${RESET}"
    if "$binary" --gtest_color=yes; then
      PASS=$((PASS + 1))
    else
      FAIL=$((FAIL + 1))
    fi
  else
    echo -e "${RED}✗ Compilation failed for ${name}${RESET}"
    FAIL=$((FAIL + 1))
  fi
}

# ── Test suites ───────────────────────────────────────────────────────────────
FILTER="${1:-all}"

if [[ "$FILTER" == "all" || "$FILTER" == "domain" ]]; then
  run_test "domain_matcher" \
    "$REPO_ROOT/tests/unit/domain_matcher_test.cc" \
    "$REPO_ROOT/eagleeye-native/blocker/domain_matcher.cc" \
    "$REPO_ROOT/eagleeye-native/blocker/blocklist_manager.cc"
fi

if [[ "$FILTER" == "all" || "$FILTER" == "url" ]]; then
  run_test "url_analyzer" \
    "$REPO_ROOT/tests/unit/url_analyzer_test.cc" \
    "$REPO_ROOT/eagleeye-native/blocker/url_analyzer.cc"
fi

if [[ "$FILTER" == "all" || "$FILTER" == "interceptor" ]]; then
  run_test "request_interceptor" \
    "$REPO_ROOT/tests/unit/request_interceptor_test.cc" \
    "$REPO_ROOT/eagleeye-native/blocker/request_interceptor.cc" \
    "$REPO_ROOT/eagleeye-native/blocker/blocklist_manager.cc" \
    "$REPO_ROOT/eagleeye-native/blocker/domain_matcher.cc" \
    "$REPO_ROOT/eagleeye-native/blocker/url_analyzer.cc" \
    "$REPO_ROOT/eagleeye-native/blocker/cname_resolver.cc"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════"
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}✓ All test suites passed (${PASS}/${PASS})${RESET}"
  exit 0
else
  echo -e "${RED}✗ ${FAIL} suite(s) failed, ${PASS} passed${RESET}"
  exit 1
fi
