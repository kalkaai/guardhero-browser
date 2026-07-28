// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// domain_matcher.h — Fast domain lookup using Bloom filter + hash map.
//
// Architecture:
//   1. Bloom filter for sub-millisecond probabilistic membership test
//      (no false negatives; small false positive rate)
//   2. std::unordered_set for exact confirmation (eliminates false positives)
//
// Lookup path:
//   IsBlocked("evil-tracker.com")
//     → Bloom filter query (< 100ns)
//       → if negative: return false immediately (not blocked)
//       → if positive: confirm with hash map (~200ns)

#ifndef EAGLEEYE_NATIVE_BLOCKER_DOMAIN_MATCHER_H_
#define EAGLEEYE_NATIVE_BLOCKER_DOMAIN_MATCHER_H_

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <unordered_set>
#include <vector>

namespace eagleeye {

// BloomFilter — simple bit-array Bloom filter.
// Uses k=4 independent hash functions derived from FNV-1a and MurmurHash3.
class BloomFilter {
 public:
  // Constructs a Bloom filter sized for |expected_items| with a target
  // false-positive rate of ~0.1% (1 in 1000).
  explicit BloomFilter(size_t expected_items);

  ~BloomFilter() = default;

  // Add a domain to the filter.
  void Add(const std::string& domain);

  // Test membership. Returns false = definitely not present.
  // Returns true = probably present (confirm with hash map).
  bool MightContain(const std::string& domain) const;

  // Number of bits in the filter.
  size_t BitCount() const { return bits_.size(); }

 private:
  std::vector<uint8_t> bits_;  // Bit array stored as byte vector
  size_t num_bits_;
  static constexpr int kNumHashFunctions = 4;

  // Hash family: returns the i-th hash position for domain
  size_t Hash(const std::string& domain, int hash_index) const;

  // Set/test individual bits
  void SetBit(size_t pos);
  bool TestBit(size_t pos) const;
};


// DomainMatcher — primary interface for domain blocking lookups.
//
// Thread safety: All public methods are thread-safe after construction.
// The matcher is populated once via AddDomain() then used read-only.
class DomainMatcher {
 public:
  DomainMatcher();
  ~DomainMatcher();

  // Move-only (unique_ptr member prevents copy).
  DomainMatcher(DomainMatcher&&) = default;
  DomainMatcher& operator=(DomainMatcher&&) = default;

  // Add a domain to the blocklist.
  // Must be called before any IsBlocked() calls (not thread-safe during load).
  void AddDomain(const std::string& domain);

  // Returns true if the exact domain or any parent domain is blocked.
  // Examples:
  //   IsBlocked("doubleclick.net")        → true (exact match)
  //   IsBlocked("stats.doubleclick.net")  → true (parent is blocked)
  //   IsBlocked("example.com")            → false
  //
  // Lookup time target: < 1ms for 93,000 domains.
  bool IsBlocked(const std::string& domain) const;

  // Returns true if the domain is blocked at the exact level (no parent check).
  bool IsBlockedExact(const std::string& domain) const;

  // Returns the number of domains loaded.
  size_t DomainCount() const { return exact_domains_.size(); }

  // Finalizes the filter after all AddDomain() calls.
  // Must be called before IsBlocked(). Builds the Bloom filter from the
  // accumulated exact_domains_ set.
  void Finalize();

 private:
  std::unique_ptr<BloomFilter> bloom_filter_;
  std::unordered_set<std::string> exact_domains_;
  bool finalized_ = false;

  // Normalize domain: lowercase, strip trailing dot, strip www. prefix
  static std::string NormalizeDomain(const std::string& domain);

  // Extract all parent domains: "a.b.c.com" → ["b.c.com", "c.com", "com"]
  static std::vector<std::string> ParentDomains(const std::string& domain);
};

}  // namespace eagleeye

#endif  // EAGLEEYE_NATIVE_BLOCKER_DOMAIN_MATCHER_H_
