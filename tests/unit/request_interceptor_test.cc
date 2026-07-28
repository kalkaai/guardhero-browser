// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// tests/unit/request_interceptor_test.cc — Unit tests for EagleEye RequestInterceptor.
//
// Build via the test runner script:
//   ./tests/run_cpp_tests.sh interceptor
//
// These tests exercise the full decision pipeline using a real BlocklistManager
// populated with a small in-memory blocklist written to a temp file.

#include "eagleeye-native/blocker/request_interceptor.h"

#include <fstream>
#include <string>
#include <thread>
#include <vector>

#include "eagleeye-native/blocker/blocklist_manager.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace eagleeye {
namespace {

// ── Test fixture ─────────────────────────────────────────────────────────────
// SetUp() is public because the gtest stub calls it directly.

class RequestInterceptorTest : public ::testing::Test {
 public:
  void SetUp() override {
    // Write a small blocklist to a temp file.
    tmp_path_ = "/tmp/eagleeye_test_blocklist.txt";
    std::ofstream f(tmp_path_);
    ASSERT_TRUE(f.is_open()) << "Failed to create temp blocklist";
    f << "# Guard Hero test blocklist\n"
      << "doubleclick.net\n"
      << "google-analytics.com\n"
      << "facebook.com\n"
      << "scorecardresearch.com\n"
      << "||hotjar.com^\n"       // ABP format — should also be parsed
      << "# a comment line\n"
      << "\n"                     // blank line — should be skipped
      << "mixpanel.com\n";
    f.close();

    blocklist_manager_ = std::make_unique<BlocklistManager>();
    auto stats = blocklist_manager_->Load(tmp_path_);
    ASSERT_TRUE(stats.load_success) << "Blocklist failed to load";
    ASSERT_GE(stats.total_domains, size_t(5));

    interceptor_ = std::make_unique<RequestInterceptor>(blocklist_manager_.get());
  }

  RequestContext MakeContext(const std::string& url,
                              const std::string& initiator = "example.com") {
    RequestContext ctx;
    ctx.url = url;
    ctx.initiator_domain = initiator;
    ctx.resource_type = "xhr";
    ctx.tab_id = 1;
    return ctx;
  }

  // Shorthand: cast Decision/BlockReason to int for EXPECT_EQ
  // (the gtest stub doesn't have operator<< for enums)
  static int D(Decision d) { return static_cast<int>(d); }
  static int R(BlockReason r) { return static_cast<int>(r); }

  std::string tmp_path_;
  std::unique_ptr<BlocklistManager> blocklist_manager_;
  std::unique_ptr<RequestInterceptor> interceptor_;
};

// ── Decision: BLOCK ───────────────────────────────────────────────────────────

TEST_F(RequestInterceptorTest, BlocksExactDomain) {
  auto result = interceptor_->Intercept(MakeContext("doubleclick.net"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
  // Reason is BLOCKLIST or CNAME_CLOAKING depending on CnameResolver state.
  EXPECT_NE(R(result.reason), R(BlockReason::NONE));
}

TEST_F(RequestInterceptorTest, BlocksSubdomainOfBlockedDomain) {
  auto result = interceptor_->Intercept(MakeContext("stats.doubleclick.net"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
  // Reason is BLOCKLIST or CNAME_CLOAKING depending on CnameResolver state.
  EXPECT_NE(R(result.reason), R(BlockReason::NONE));
}

TEST_F(RequestInterceptorTest, BlocksDeepSubdomain) {
  auto result = interceptor_->Intercept(MakeContext("cm.g.doubleclick.net"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
}

TEST_F(RequestInterceptorTest, BlocksAbpFormatDomain) {
  // hotjar.com was added in ABP "||hotjar.com^" format
  auto result = interceptor_->Intercept(MakeContext("hotjar.com"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
  // Reason is BLOCKLIST or CNAME_CLOAKING depending on CnameResolver state.
  EXPECT_NE(R(result.reason), R(BlockReason::NONE));
}

TEST_F(RequestInterceptorTest, BlocksFullUrl) {
  auto result = interceptor_->Intercept(
      MakeContext("https://www.google-analytics.com/collect?v=1&t=pageview"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
}

// ── Decision: ALLOW ───────────────────────────────────────────────────────────

TEST_F(RequestInterceptorTest, AllowsSafeDomain) {
  auto result = interceptor_->Intercept(MakeContext("example.com"));
  EXPECT_EQ(D(result.decision), D(Decision::ALLOW));
}

TEST_F(RequestInterceptorTest, AllowsSubdomainOfSafeDomain) {
  auto result = interceptor_->Intercept(MakeContext("cdn.example.com"));
  EXPECT_EQ(D(result.decision), D(Decision::ALLOW));
}

TEST_F(RequestInterceptorTest, AllowsWwwPrefixedSafeDomain) {
  auto result = interceptor_->Intercept(MakeContext("www.example.com"));
  EXPECT_EQ(D(result.decision), D(Decision::ALLOW));
}

TEST_F(RequestInterceptorTest, AllowsEmptyHost) {
  auto result = interceptor_->Intercept(MakeContext(""));
  EXPECT_EQ(D(result.decision), D(Decision::ALLOW));
}

// ── User allowlist overrides blocklist ────────────────────────────────────────

TEST_F(RequestInterceptorTest, UserAllowlistOverridesBlocklist) {
  interceptor_->AllowDomain("doubleclick.net");
  auto result = interceptor_->Intercept(MakeContext("doubleclick.net"));
  EXPECT_EQ(D(result.decision), D(Decision::ALLOW));
}

TEST_F(RequestInterceptorTest, UserAllowlistCoversSubdomains) {
  interceptor_->AllowDomain("doubleclick.net");
  auto result = interceptor_->Intercept(MakeContext("stats.doubleclick.net"));
  EXPECT_EQ(D(result.decision), D(Decision::ALLOW));
}

TEST_F(RequestInterceptorTest, RemoveAllowlistRestoresBlocking) {
  interceptor_->AllowDomain("doubleclick.net");
  interceptor_->RemoveAllowedDomain("doubleclick.net");
  auto result = interceptor_->Intercept(MakeContext("doubleclick.net"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
}

TEST_F(RequestInterceptorTest, IsDomainAllowedReturnsCorrectly) {
  EXPECT_FALSE(interceptor_->IsDomainAllowed("doubleclick.net"));
  interceptor_->AllowDomain("doubleclick.net");
  EXPECT_TRUE(interceptor_->IsDomainAllowed("doubleclick.net"));
  interceptor_->RemoveAllowedDomain("doubleclick.net");
  EXPECT_FALSE(interceptor_->IsDomainAllowed("doubleclick.net"));
}

// ── User blocklist ────────────────────────────────────────────────────────────

TEST_F(RequestInterceptorTest, UserBlocklistBlocksSafeDomain) {
  interceptor_->BlockDomain("trusted-but-blocked.com");
  auto result = interceptor_->Intercept(MakeContext("trusted-but-blocked.com"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
  EXPECT_EQ(R(result.reason), R(BlockReason::USER_BLOCKED));
}

TEST_F(RequestInterceptorTest, UserBlocklistReasonDistinctFromStaticList) {
  auto blocked_static = interceptor_->Intercept(MakeContext("doubleclick.net"));
  interceptor_->BlockDomain("my-custom-block.com");
  auto blocked_user = interceptor_->Intercept(MakeContext("my-custom-block.com"));

  EXPECT_EQ(R(blocked_static.reason), R(BlockReason::BLOCKLIST));
  EXPECT_EQ(R(blocked_user.reason), R(BlockReason::USER_BLOCKED));
}

// ── Decision: MODIFY (tracking param stripping) ───────────────────────────────

TEST_F(RequestInterceptorTest, StripsUtmParams) {
  auto result = interceptor_->Intercept(MakeContext(
      "https://example.com/page?utm_source=newsletter&utm_medium=email&id=123"));
  EXPECT_EQ(D(result.decision), D(Decision::MODIFY));
  EXPECT_FALSE(result.modified_url.empty());
  EXPECT_EQ(result.modified_url.find("utm_source"), std::string::npos);
  EXPECT_NE(result.modified_url.find("id=123"), std::string::npos);
  EXPECT_FALSE(result.stripped_params.empty());
}

TEST_F(RequestInterceptorTest, StripsGclidParam) {
  auto result = interceptor_->Intercept(MakeContext(
      "https://example.com/?gclid=abc123&q=search"));
  EXPECT_EQ(D(result.decision), D(Decision::MODIFY));
  EXPECT_EQ(result.modified_url.find("gclid"), std::string::npos);
}

TEST_F(RequestInterceptorTest, StripsFbclidParam) {
  auto result = interceptor_->Intercept(MakeContext(
      "https://example.com/post?fbclid=xyz789"));
  EXPECT_EQ(D(result.decision), D(Decision::MODIFY));
  EXPECT_EQ(result.modified_url.find("fbclid"), std::string::npos);
}

TEST_F(RequestInterceptorTest, AllowsUrlWithNoTrackingParams) {
  auto result = interceptor_->Intercept(MakeContext(
      "https://example.com/page?q=hello&page=2"));
  EXPECT_EQ(D(result.decision), D(Decision::ALLOW));
  EXPECT_TRUE(result.modified_url.empty());
}

TEST_F(RequestInterceptorTest, BlockTakesPriorityOverModify) {
  // google-analytics.com is on blocklist — even with UTM params, BLOCK wins.
  auto result = interceptor_->Intercept(MakeContext(
      "https://google-analytics.com/collect?utm_source=test&v=1"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
}

// ── Statistics ────────────────────────────────────────────────────────────────

TEST_F(RequestInterceptorTest, StatsIncrementCorrectly) {
  interceptor_->Intercept(MakeContext("doubleclick.net"));                    // BLOCK
  interceptor_->Intercept(MakeContext("example.com"));                        // ALLOW
  interceptor_->Intercept(MakeContext("example.com"));                        // ALLOW
  interceptor_->Intercept(MakeContext("https://example.com/?utm_source=x"));  // MODIFY

  auto stats = interceptor_->GetStats();
  EXPECT_EQ(stats.total_requests, int64_t(4));
  EXPECT_EQ(stats.blocked,        int64_t(1));
  EXPECT_EQ(stats.allowed,        int64_t(2));
  EXPECT_EQ(stats.modified,       int64_t(1));
}

TEST_F(RequestInterceptorTest, ResetStatsClearsAllCounters) {
  interceptor_->Intercept(MakeContext("doubleclick.net"));
  interceptor_->Intercept(MakeContext("example.com"));
  interceptor_->ResetStats();

  auto stats = interceptor_->GetStats();
  EXPECT_EQ(stats.total_requests, int64_t(0));
  EXPECT_EQ(stats.blocked,        int64_t(0));
  EXPECT_EQ(stats.allowed,        int64_t(0));
}

// ── Thread safety ─────────────────────────────────────────────────────────────

TEST_F(RequestInterceptorTest, ConcurrentInterceptCallsAreThreadSafe) {
  const int kThreads = 4;
  const int kCallsPerThread = 250;
  std::vector<std::thread> threads;

  for (int t = 0; t < kThreads; ++t) {
    threads.emplace_back([this, t]() {
      for (int i = 0; i < kCallsPerThread; ++i) {
        if (i % 3 == 0)
          interceptor_->Intercept(MakeContext("doubleclick.net"));
        else if (i % 3 == 1)
          interceptor_->Intercept(MakeContext("example.com"));
        else
          interceptor_->Intercept(MakeContext(
              "https://example.com/?utm_source=thread" + std::to_string(t)));
      }
    });
  }
  for (auto& th : threads) th.join();

  auto stats = interceptor_->GetStats();
  EXPECT_EQ(stats.total_requests, int64_t(kThreads * kCallsPerThread));
}

// ── URL extraction edge cases ─────────────────────────────────────────────────

TEST_F(RequestInterceptorTest, ExtractsHostFromHttpsUrl) {
  auto result = interceptor_->Intercept(MakeContext("https://doubleclick.net/path?q=1"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
}

TEST_F(RequestInterceptorTest, ExtractsHostFromUrlWithPort) {
  auto result = interceptor_->Intercept(MakeContext("https://doubleclick.net:8443/track"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
}

TEST_F(RequestInterceptorTest, ExtractsHostStrippingWwwPrefix) {
  auto result = interceptor_->Intercept(MakeContext("https://www.doubleclick.net/"));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
}

TEST_F(RequestInterceptorTest, HandlesFqdnWithTrailingDot) {
  auto result = interceptor_->Intercept(MakeContext("doubleclick.net."));
  EXPECT_EQ(D(result.decision), D(Decision::BLOCK));
}

}  // namespace
}  // namespace eagleeye
