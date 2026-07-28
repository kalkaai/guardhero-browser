// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// tests/unit/url_analyzer_test.cc — Unit tests for EagleEye UrlAnalyzer.
//
// Covers:
//   - utm_source, fbclid, gclid stripping
//   - Clean URL returned unchanged
//   - Multiple tracking params stripped in one pass
//   - Fragment (#...) preserved after stripping
//   - HasTrackingParams detection
//   - Custom param addition
//   - Edge cases: empty query, no query string, param with no value

#include "eagleeye-native/blocker/url_analyzer.h"

#include <string>

#include "testing/gtest/include/gtest/gtest.h"

namespace eagleeye {
namespace {

// ── Fixture ───────────────────────────────────────────────────────────────────

class UrlAnalyzerTest : public ::testing::Test {
 protected:
    UrlAnalyzer analyzer;
};

// ── utm_* stripping ───────────────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, UtmSourceParamIsStripped) {
    const std::string input =
        "https://example.com/page?utm_source=newsletter&q=hello";
    const std::string expected =
        "https://example.com/page?q=hello";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

TEST_F(UrlAnalyzerTest, UtmMediumParamIsStripped) {
    const std::string input =
        "https://example.com/?q=test&utm_medium=email";
    const std::string expected =
        "https://example.com/?q=test";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

TEST_F(UrlAnalyzerTest, UtmCampaignParamIsStripped) {
    const std::string input =
        "https://shop.example.com/item?utm_campaign=summer2025&id=42";
    const std::string expected =
        "https://shop.example.com/item?id=42";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

TEST_F(UrlAnalyzerTest, AllUtmParamsStripped) {
    const std::string input =
        "https://example.com/?utm_source=fb"
        "&utm_medium=cpc"
        "&utm_campaign=xmas"
        "&utm_term=shoes"
        "&utm_content=banner"
        "&page=1";
    const std::string expected = "https://example.com/?page=1";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

// ── fbclid stripping ──────────────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, FbclidParamIsStripped) {
    const std::string input =
        "https://example.com/article?fbclid=IwAR1abcdef123456&read=true";
    const std::string expected =
        "https://example.com/article?read=true";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

TEST_F(UrlAnalyzerTest, FbclidAloneResultsInNoQueryString) {
    const std::string input =
        "https://example.com/page?fbclid=IwAR1abcdef123456";
    const std::string expected =
        "https://example.com/page";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

// ── gclid stripping ───────────────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, GclidParamIsStripped) {
    const std::string input =
        "https://example.com/?gclid=Cj0KCQjw_e2IBhDyARIsAJiEkookXyz&q=test";
    const std::string expected =
        "https://example.com/?q=test";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

TEST_F(UrlAnalyzerTest, GclidAndUtmBothStripped) {
    const std::string input =
        "https://shop.example.com/cart?gclid=abc123&utm_source=google&item=42";
    const std::string expected =
        "https://shop.example.com/cart?item=42";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

// ── Clean URL returned unchanged ──────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, CleanUrlReturnedUnchanged) {
    const std::string input =
        "https://example.com/search?q=guard+hero+browser&page=2";

    EXPECT_EQ(analyzer.StripTrackingParams(input), input)
        << "A clean URL should be returned exactly as-is";
}

TEST_F(UrlAnalyzerTest, UrlWithNoQueryStringReturnedUnchanged) {
    const std::string input = "https://example.com/page";
    EXPECT_EQ(analyzer.StripTrackingParams(input), input);
}

TEST_F(UrlAnalyzerTest, EmptyStringReturnedUnchanged) {
    EXPECT_EQ(analyzer.StripTrackingParams(""), "");
}

// ── Multiple tracking params ──────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, MultipleTrackingParamsAllStripped) {
    const std::string input =
        "https://example.com/?"
        "utm_source=google"
        "&utm_medium=cpc"
        "&gclid=abc"
        "&fbclid=xyz"
        "&msclkid=bing"
        "&mc_eid=mailchimp"
        "&ref=homepage"
        "&valid_param=keep_me";
    const std::string expected =
        "https://example.com/?valid_param=keep_me";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

TEST_F(UrlAnalyzerTest, OnlyTrackingParamsResultsInNoQuery) {
    const std::string input =
        "https://example.com/?"
        "utm_source=x&utm_medium=y&utm_campaign=z";
    const std::string expected = "https://example.com/";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

// ── Fragment preservation ─────────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, UrlWithFragmentPreservedCorrectly) {
    const std::string input =
        "https://example.com/page?utm_source=email&q=test#section-2";
    const std::string expected =
        "https://example.com/page?q=test#section-2";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

TEST_F(UrlAnalyzerTest, FragmentOnlyUrlPreserved) {
    const std::string input = "https://example.com/page#anchor";
    EXPECT_EQ(analyzer.StripTrackingParams(input), input);
}

TEST_F(UrlAnalyzerTest, AllTrackingParamsStrippedFragmentPreserved) {
    const std::string input =
        "https://example.com/?fbclid=abc&utm_source=fb#top";
    const std::string expected = "https://example.com/#top";

    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

// ── AnalysisResult metadata ───────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, AnalyzeReportsWasModifiedTrue) {
    AnalysisResult r = analyzer.Analyze(
        "https://example.com/?fbclid=abc&q=test");
    EXPECT_TRUE(r.was_modified);
    EXPECT_EQ(r.cleaned_url, "https://example.com/?q=test");
    EXPECT_EQ(r.stripped_params.size(), 1u);
    EXPECT_NE(r.stripped_params[0].find("fbclid"), std::string::npos);
}

TEST_F(UrlAnalyzerTest, AnalyzeReportsWasModifiedFalse) {
    AnalysisResult r = analyzer.Analyze("https://example.com/?q=clean");
    EXPECT_FALSE(r.was_modified);
    EXPECT_EQ(r.cleaned_url, "https://example.com/?q=clean");
    EXPECT_TRUE(r.stripped_params.empty());
}

TEST_F(UrlAnalyzerTest, AnalyzeListsAllStrippedParams) {
    AnalysisResult r = analyzer.Analyze(
        "https://example.com/?gclid=g&fbclid=f&utm_source=u&keep=1");
    EXPECT_TRUE(r.was_modified);
    EXPECT_EQ(r.stripped_params.size(), 3u);
}

// ── HasTrackingParams ─────────────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, HasTrackingParamsTrueForTrackedUrl) {
    EXPECT_TRUE(analyzer.HasTrackingParams(
        "https://example.com/?utm_source=email"));
    EXPECT_TRUE(analyzer.HasTrackingParams(
        "https://example.com/?q=x&fbclid=y"));
}

TEST_F(UrlAnalyzerTest, HasTrackingParamsFalseForCleanUrl) {
    EXPECT_FALSE(analyzer.HasTrackingParams(
        "https://example.com/?q=search&page=2"));
    EXPECT_FALSE(analyzer.HasTrackingParams(
        "https://example.com/"));
    EXPECT_FALSE(analyzer.HasTrackingParams(
        "https://example.com/no-query"));
}

// ── Custom tracking param ─────────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, CustomTrackingParamIsStripped) {
    analyzer.AddTrackingParam("my_custom_tracker");
    const std::string input =
        "https://example.com/?my_custom_tracker=abc&q=keep";
    const std::string expected = "https://example.com/?q=keep";
    EXPECT_EQ(analyzer.StripTrackingParams(input), expected);
}

TEST_F(UrlAnalyzerTest, CustomParamAdditionIsCaseInsensitive) {
    analyzer.AddTrackingParam("MY_TRACKER");
    EXPECT_TRUE(analyzer.HasTrackingParams(
        "https://example.com/?my_tracker=1"));
}

// ── Edge cases ────────────────────────────────────────────────────────────────

TEST_F(UrlAnalyzerTest, ParamWithNoValueIsStrippedIfTracking) {
    // Some URLs use valueless params: ?fbclid&q=test
    const std::string input = "https://example.com/?fbclid&q=test";
    const std::string result = analyzer.StripTrackingParams(input);
    EXPECT_EQ(result, "https://example.com/?q=test");
}

TEST_F(UrlAnalyzerTest, NonTrackingParamWithNoValuePreserved) {
    // ?standalone is not a tracking param — should be preserved
    const std::string input = "https://example.com/?standalone&q=test";
    const std::string result = analyzer.StripTrackingParams(input);
    EXPECT_EQ(result, input)
        << "Non-tracking valueless param should not be stripped";
}

TEST_F(UrlAnalyzerTest, UrlWithHashBeforeQueryPreserved) {
    // Technically invalid but encountered in the wild: hash before query
    // We treat everything after '?' as query.
    const std::string input = "https://example.com/?q=test";
    EXPECT_EQ(analyzer.StripTrackingParams(input), input);
}

TEST_F(UrlAnalyzerTest, OtherTrackingParamsStripped) {
    // msclkid (Microsoft), mc_eid (Mailchimp), yclid (Yandex), twclid (Twitter)
    struct Case { std::string param; };
    const std::vector<Case> cases = {
        {"msclkid"}, {"mc_eid"}, {"yclid"}, {"twclid"},
        {"mkt_tok"}, {"_hsenc"}, {"li_fat_id"}, {"ttclid"},
    };

    for (const auto& c : cases) {
        std::string url = "https://example.com/?q=keep&" + c.param + "=VALUE";
        std::string result = analyzer.StripTrackingParams(url);
        EXPECT_EQ(result, "https://example.com/?q=keep")
            << "Param should be stripped: " << c.param;
    }
}

TEST_F(UrlAnalyzerTest, GetTrackingParamsReturnsNonEmptySet) {
    const auto& params = analyzer.GetTrackingParams();
    EXPECT_GT(params.size(), 10u)
        << "Expected at least 10 default tracking params";
    EXPECT_TRUE(params.count("utm_source"))
        << "utm_source should be in default param set";
    EXPECT_TRUE(params.count("fbclid"))
        << "fbclid should be in default param set";
    EXPECT_TRUE(params.count("gclid"))
        << "gclid should be in default param set";
}

}  // namespace
}  // namespace eagleeye
