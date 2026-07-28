// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// domain_matcher.cc — Implementation of BloomFilter and DomainMatcher.

#include "eagleeye-native/blocker/domain_matcher.h"

#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstring>
#include <sstream>

namespace eagleeye {

// ─────────────────────────────────────────────────────────────────────────────
// BloomFilter
// ─────────────────────────────────────────────────────────────────────────────

namespace {

// FNV-1a 64-bit hash
uint64_t Fnv1a64(const std::string& data, uint64_t seed = 14695981039346656037ULL) {
  uint64_t hash = seed;
  for (unsigned char c : data) {
    hash ^= static_cast<uint64_t>(c);
    hash *= 1099511628211ULL;
  }
  return hash;
}

// MurmurHash3 finalizer (avalanche)
uint64_t Murmur3Avalanche(uint64_t h) {
  h ^= h >> 33;
  h *= 0xff51afd7ed558ccdULL;
  h ^= h >> 33;
  h *= 0xc4ceb9fe1a85ec53ULL;
  h ^= h >> 33;
  return h;
}

}  // namespace

BloomFilter::BloomFilter(size_t expected_items) {
  // Target false positive rate: ~0.1%
  // Optimal bits per item: -ln(0.001) / (ln(2)^2) ≈ 14.4 → use 15
  const double bits_per_item = 15.0;
  num_bits_ = static_cast<size_t>(std::ceil(expected_items * bits_per_item));
  // Round up to byte boundary
  size_t num_bytes = (num_bits_ + 7) / 8;
  bits_.assign(num_bytes, 0);
  num_bits_ = num_bytes * 8;
}

void BloomFilter::SetBit(size_t pos) {
  bits_[pos / 8] |= (1u << (pos % 8));
}

bool BloomFilter::TestBit(size_t pos) const {
  return (bits_[pos / 8] & (1u << (pos % 8))) != 0;
}

size_t BloomFilter::Hash(const std::string& domain, int hash_index) const {
  // Generate independent hashes using double-hashing:
  // h_i(x) = (h1(x) + i * h2(x)) mod m
  uint64_t h1 = Fnv1a64(domain);
  uint64_t h2 = Murmur3Avalanche(h1 + static_cast<uint64_t>(hash_index) * 2654435769ULL);
  uint64_t combined = h1 + static_cast<uint64_t>(hash_index) * h2;
  return static_cast<size_t>(combined % num_bits_);
}

void BloomFilter::Add(const std::string& domain) {
  for (int i = 0; i < kNumHashFunctions; ++i) {
    SetBit(Hash(domain, i));
  }
}

bool BloomFilter::MightContain(const std::string& domain) const {
  for (int i = 0; i < kNumHashFunctions; ++i) {
    if (!TestBit(Hash(domain, i))) {
      return false;  // Definitely not present
    }
  }
  return true;  // Probably present
}

// ─────────────────────────────────────────────────────────────────────────────
// DomainMatcher
// ─────────────────────────────────────────────────────────────────────────────

DomainMatcher::DomainMatcher() = default;
DomainMatcher::~DomainMatcher() = default;

// static
std::string DomainMatcher::NormalizeDomain(const std::string& domain) {
  std::string normalized = domain;

  // Lowercase
  std::transform(normalized.begin(), normalized.end(), normalized.begin(),
                 [](unsigned char c) { return std::tolower(c); });

  // Strip trailing dot
  if (!normalized.empty() && normalized.back() == '.') {
    normalized.pop_back();
  }

  // Strip leading "www." to canonicalize
  // Note: we do NOT strip www. from the actual domain because trackers often
  // use "www.tracker.com" as a distinct subdomain. We only strip for lookup.
  return normalized;
}

// static
std::vector<std::string> DomainMatcher::ParentDomains(const std::string& domain) {
  std::vector<std::string> parents;
  size_t pos = 0;
  while ((pos = domain.find('.', pos)) != std::string::npos) {
    ++pos;
    std::string parent = domain.substr(pos);
    // Only add if it has at least one dot (avoid bare TLDs like "com")
    if (parent.find('.') != std::string::npos) {
      parents.push_back(parent);
    }
  }
  return parents;
}

void DomainMatcher::AddDomain(const std::string& domain) {
  assert(!finalized_ && "AddDomain called after Finalize()");
  std::string normalized = NormalizeDomain(domain);
  if (!normalized.empty()) {
    exact_domains_.insert(normalized);
  }
}

void DomainMatcher::Finalize() {
  assert(!finalized_);
  // Size the Bloom filter for our domain count with some headroom
  bloom_filter_ = std::make_unique<BloomFilter>(
      std::max(exact_domains_.size() * 2, static_cast<size_t>(100000)));
  for (const auto& domain : exact_domains_) {
    bloom_filter_->Add(domain);
  }
  finalized_ = true;
}

bool DomainMatcher::IsBlockedExact(const std::string& domain) const {
  assert(finalized_ && "Must call Finalize() before IsBlocked()");
  std::string normalized = NormalizeDomain(domain);

  // Fast Bloom filter check
  if (!bloom_filter_->MightContain(normalized)) {
    return false;  // Definitely not blocked
  }

  // Confirm with exact hash set
  return exact_domains_.count(normalized) > 0;
}

bool DomainMatcher::IsBlocked(const std::string& domain) const {
  assert(finalized_ && "Must call Finalize() before IsBlocked()");
  std::string normalized = NormalizeDomain(domain);

  // Check exact domain first
  if (IsBlockedExact(normalized)) {
    return true;
  }

  // Check all parent domains (e.g., "stats.tracker.com" → "tracker.com")
  for (const auto& parent : ParentDomains(normalized)) {
    if (IsBlockedExact(parent)) {
      return true;
    }
  }

  return false;
}

}  // namespace eagleeye
