// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// tests/unit/domain_matcher_test.cc — Unit tests for EagleEye DomainMatcher.
//
// Build (in the Chromium tree):
//   autoninja -C out/Release eagleeye_unit_tests
//
// BUILD.gn entry (add to eagleeye-native/BUILD.gn):
//   test("eagleeye_unit_tests") {
//     sources = [
//       "//tests/unit/domain_matcher_test.cc",
//       "//tests/unit/url_analyzer_test.cc",
//     ]
//     deps = [
//       "//eagleeye-native/blocker:eagleeye_blocker",
//       "//testing/gtest",
//       "//testing/gtest:gtest_main",
//     ]
//   }

#include "eagleeye-native/blocker/domain_matcher.h"

#include <chrono>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "testing/gtest/include/gtest/gtest.h"

namespace eagleeye {
namespace {

// ── Fixture ───────────────────────────────────────────────────────────────────

// A small, representative set of known tracker domains used across multiple tests.
const std::vector<std::string> kTrackerDomains = {
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "adnxs.com",
    "scorecardresearch.com",
    "quantserve.com",
    "taboola.com",
    "outbrain.com",
    "pubmatic.com",
    "rubiconproject.com",
    "criteo.com",
    "advertising.com",
    "turn.com",
    "moatads.com",
    "casalemedia.com",
    "contextweb.com",
    "openx.net",
    "adsrvr.org",
    "demdex.net",
    "ads.twitter.com",
};

// Build a matcher loaded with kTrackerDomains.
DomainMatcher BuildTestMatcher() {
    DomainMatcher m;
    for (const auto& d : kTrackerDomains) {
        m.AddDomain(d);
    }
    m.Finalize();
    return m;
}

// Build a large matcher with N synthetic domains for performance tests.
DomainMatcher BuildLargeMatcher(size_t count) {
    DomainMatcher m;
    for (size_t i = 0; i < count; ++i) {
        std::ostringstream oss;
        oss << "tracker" << i << ".example.com";
        m.AddDomain(oss.str());
    }
    // Add all the real tracker domains too
    for (const auto& d : kTrackerDomains) {
        m.AddDomain(d);
    }
    m.Finalize();
    return m;
}

// ── Tests: basic blocking ─────────────────────────────────────────────────────

TEST(DomainMatcherTest, KnownTrackerDomainIsBlocked) {
    DomainMatcher m = BuildTestMatcher();
    EXPECT_TRUE(m.IsBlocked("doubleclick.net"))
        << "doubleclick.net should be blocked";
    EXPECT_TRUE(m.IsBlocked("googlesyndication.com"))
        << "googlesyndication.com should be blocked";
    EXPECT_TRUE(m.IsBlocked("criteo.com"))
        << "criteo.com should be blocked";
    EXPECT_TRUE(m.IsBlocked("adnxs.com"))
        << "adnxs.com should be blocked";
}

TEST(DomainMatcherTest, KnownCleanDomainIsNotBlocked) {
    DomainMatcher m = BuildTestMatcher();
    EXPECT_FALSE(m.IsBlocked("example.com"))
        << "example.com should not be blocked";
    EXPECT_FALSE(m.IsBlocked("en.wikipedia.org"))
        << "wikipedia.org should not be blocked";
    EXPECT_FALSE(m.IsBlocked("github.com"))
        << "github.com should not be blocked";
    EXPECT_FALSE(m.IsBlocked("duckduckgo.com"))
        << "duckduckgo.com should not be blocked";
    EXPECT_FALSE(m.IsBlocked("guardhero.app"))
        << "guardhero.app should not be blocked";
}

// ── Tests: subdomain matching ─────────────────────────────────────────────────

TEST(DomainMatcherTest, SubdomainOfBlockedDomainIsBlocked) {
    DomainMatcher m = BuildTestMatcher();

    // stats.doubleclick.net → parent doubleclick.net is blocked
    EXPECT_TRUE(m.IsBlocked("stats.doubleclick.net"))
        << "stats.doubleclick.net should be blocked via parent";

    // ad.googlesyndication.com → parent is blocked
    EXPECT_TRUE(m.IsBlocked("ad.googlesyndication.com"))
        << "ad.googlesyndication.com should be blocked via parent";

    // deep.nested.subdomain.criteo.com
    EXPECT_TRUE(m.IsBlocked("deep.nested.subdomain.criteo.com"))
        << "deep subdomain of blocked domain should be blocked";

    // www.adnxs.com
    EXPECT_TRUE(m.IsBlocked("www.adnxs.com"))
        << "www.adnxs.com should be blocked via parent";
}

TEST(DomainMatcherTest, SubdomainOfCleanDomainIsNotBlocked) {
    DomainMatcher m = BuildTestMatcher();

    EXPECT_FALSE(m.IsBlocked("api.github.com"))
        << "api.github.com should not be blocked";
    EXPECT_FALSE(m.IsBlocked("en.wikipedia.org"))
        << "en.wikipedia.org should not be blocked";
}

// ── Tests: case normalisation ─────────────────────────────────────────────────

TEST(DomainMatcherTest, DomainLookupIsCaseInsensitive) {
    DomainMatcher m = BuildTestMatcher();

    EXPECT_TRUE(m.IsBlocked("DOUBLECLICK.NET"))
        << "Uppercase domain should still be blocked";
    EXPECT_TRUE(m.IsBlocked("DoubleClick.Net"))
        << "Mixed-case domain should still be blocked";
    EXPECT_TRUE(m.IsBlocked("STATS.DOUBLECLICK.NET"))
        << "Uppercase subdomain of blocked domain should be blocked";
}

TEST(DomainMatcherTest, TrailingDotStripped) {
    DomainMatcher m = BuildTestMatcher();

    EXPECT_TRUE(m.IsBlocked("doubleclick.net."))
        << "Domain with trailing dot should be blocked";
    EXPECT_FALSE(m.IsBlocked("example.com."))
        << "Clean domain with trailing dot should not be blocked";
}

// ── Tests: exact vs. parent lookup ────────────────────────────────────────────

TEST(DomainMatcherTest, IsBlockedExactDoesNotMatchSubdomains) {
    DomainMatcher m = BuildTestMatcher();

    // Exact match
    EXPECT_TRUE(m.IsBlockedExact("doubleclick.net"));

    // Subdomain should NOT match with IsBlockedExact
    EXPECT_FALSE(m.IsBlockedExact("stats.doubleclick.net"))
        << "IsBlockedExact should not match subdomains";
}

TEST(DomainMatcherTest, IsBlockedChecksParents) {
    DomainMatcher m = BuildTestMatcher();

    EXPECT_TRUE(m.IsBlocked("a.b.c.doubleclick.net"))
        << "IsBlocked should check parent domains";
    EXPECT_FALSE(m.IsBlockedExact("a.b.c.doubleclick.net"))
        << "IsBlockedExact should not match this";
}

// ── Tests: empty / edge cases ─────────────────────────────────────────────────

TEST(DomainMatcherTest, EmptyDomainReturnsFalse) {
    DomainMatcher m = BuildTestMatcher();
    EXPECT_FALSE(m.IsBlocked(""));
    EXPECT_FALSE(m.IsBlockedExact(""));
}

TEST(DomainMatcherTest, BareTLDNotBlocked) {
    DomainMatcher m = BuildTestMatcher();
    // We never add bare TLDs; parent-check stops before them.
    EXPECT_FALSE(m.IsBlocked("com"));
    EXPECT_FALSE(m.IsBlocked("net"));
    EXPECT_FALSE(m.IsBlocked("org"));
}

TEST(DomainMatcherTest, DomainCountReflectsAddCalls) {
    DomainMatcher m;
    m.AddDomain("foo.com");
    m.AddDomain("bar.com");
    m.AddDomain("foo.com");  // duplicate — should not double-count
    m.Finalize();
    EXPECT_EQ(m.DomainCount(), 2u);
}

// ── Tests: blocklist reload ───────────────────────────────────────────────────

TEST(DomainMatcherTest, BlocklistReloadWorks) {
    // First load
    DomainMatcher m1;
    m1.AddDomain("evil-tracker-v1.com");
    m1.Finalize();
    EXPECT_TRUE(m1.IsBlocked("evil-tracker-v1.com"));
    EXPECT_FALSE(m1.IsBlocked("evil-tracker-v2.com"));

    // Simulate reload: create a new matcher (blocklist_manager replaces the
    // existing DomainMatcher with a newly-built one atomically)
    DomainMatcher m2;
    m2.AddDomain("evil-tracker-v2.com");
    m2.Finalize();
    EXPECT_FALSE(m2.IsBlocked("evil-tracker-v1.com"));
    EXPECT_TRUE(m2.IsBlocked("evil-tracker-v2.com"));

    // Original matcher is unaffected
    EXPECT_TRUE(m1.IsBlocked("evil-tracker-v1.com"));
}

TEST(DomainMatcherTest, MultipleFinalizeCalls_SecondMatcherIndependent) {
    // Two independently built matchers with different domains
    DomainMatcher ma, mb;
    ma.AddDomain("only-in-a.com");
    mb.AddDomain("only-in-b.com");
    ma.Finalize();
    mb.Finalize();

    EXPECT_TRUE(ma.IsBlocked("only-in-a.com"));
    EXPECT_FALSE(ma.IsBlocked("only-in-b.com"));
    EXPECT_FALSE(mb.IsBlocked("only-in-a.com"));
    EXPECT_TRUE(mb.IsBlocked("only-in-b.com"));
}

// ── Performance benchmark ─────────────────────────────────────────────────────

TEST(DomainMatcherTest, LookupTimeFor93kDomainsUnder1ms) {
    // Build a matcher with ~93,000 domains (simulating real blocklist size)
    constexpr size_t kBlocklistSize = 93000;
    DomainMatcher m = BuildLargeMatcher(kBlocklistSize);

    ASSERT_GE(m.DomainCount(), kBlocklistSize)
        << "Expected at least " << kBlocklistSize << " domains loaded";

    // Measure lookup time for a known-blocked domain
    const std::string kLookupDomain = "stats.doubleclick.net";

    // Warm-up pass (instruction cache priming)
    for (int i = 0; i < 100; ++i) {
        (void)m.IsBlocked(kLookupDomain);
    }

    // Timed measurement: average over 10,000 lookups
    constexpr int kIterations = 10000;
    auto start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < kIterations; ++i) {
        bool result = m.IsBlocked(kLookupDomain);
        (void)result;
    }
    auto end = std::chrono::high_resolution_clock::now();

    double total_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();
    double avg_ns   = total_ns / kIterations;
    double avg_ms   = avg_ns / 1e6;

    EXPECT_LT(avg_ms, 1.0)
        << "Average lookup time " << avg_ms << "ms exceeds 1ms target "
        << "(average over " << kIterations << " iterations)";

    // Also print for debugging (visible with --gtest_print_time)
    std::cout << "[BENCH] IsBlocked(" << kLookupDomain << ") over "
              << kBlocklistSize << " domains: avg " << avg_ns << "ns ("
              << avg_ms << "ms)\n";
}

TEST(DomainMatcherTest, LookupTimeForMissDomainUnder1ms) {
    // Lookups for non-blocked domains should also be fast (Bloom filter catches most)
    constexpr size_t kBlocklistSize = 93000;
    DomainMatcher m = BuildLargeMatcher(kBlocklistSize);

    const std::string kMissDomain = "en.wikipedia.org";
    constexpr int kIterations = 10000;

    // Warm-up
    for (int i = 0; i < 100; ++i) (void)m.IsBlocked(kMissDomain);

    auto start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < kIterations; ++i) (void)m.IsBlocked(kMissDomain);
    auto end = std::chrono::high_resolution_clock::now();

    double avg_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count()
                    / static_cast<double>(kIterations);
    double avg_ms = avg_ns / 1e6;

    EXPECT_LT(avg_ms, 1.0)
        << "Average miss lookup time " << avg_ms << "ms exceeds 1ms target";

    std::cout << "[BENCH] IsBlocked(" << kMissDomain << ") miss path: avg "
              << avg_ns << "ns (" << avg_ms << "ms)\n";
}

// ── BloomFilter unit tests ────────────────────────────────────────────────────

TEST(BloomFilterTest, AddAndMightContain) {
    BloomFilter bf(1000);
    bf.Add("tracker.com");
    bf.Add("ads.example.com");

    EXPECT_TRUE(bf.MightContain("tracker.com"));
    EXPECT_TRUE(bf.MightContain("ads.example.com"));
}

TEST(BloomFilterTest, DefiniteNegative) {
    BloomFilter bf(1000);
    bf.Add("only-this.com");

    // These were never added; Bloom filter should return false for many of them.
    // (A small number of false positives is acceptable and expected.)
    int false_positives = 0;
    for (int i = 0; i < 100; ++i) {
        std::string domain = "not-added-" + std::to_string(i) + ".com";
        if (bf.MightContain(domain)) ++false_positives;
    }
    // With 1 item in a filter sized for 1000, FP rate should be negligible.
    EXPECT_LT(false_positives, 5)
        << "Unexpectedly high false positive rate: " << false_positives << "/100";
}

TEST(BloomFilterTest, BitCountIsReasonable) {
    BloomFilter bf(100000);
    // Should be roughly 100000 * 15 bits = ~183KB
    EXPECT_GT(bf.BitCount(), 100000u);
    EXPECT_LT(bf.BitCount(), 10000000u);  // Not absurdly large
}

}  // namespace
}  // namespace eagleeye
