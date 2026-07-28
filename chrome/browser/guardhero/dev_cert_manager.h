// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// dev_cert_manager.h — Local CA certificate generation and trust injection
// for the Guard Hero DevMode local HTTPS proxy.
//
// On first DevMode activation this component:
//   1. Generates a self-signed CA certificate using BoringSSL (already
//      shipped inside Chromium's //third_party/boringssl).
//   2. Writes the CA cert + private key to ~/.guardhero/dev-certs/ca.pem and
//      ~/.guardhero/dev-certs/ca-key.pem.
//   3. Injects the CA cert into the browser's own certificate store
//      (net::CertVerifier / X509Certificate store) — NOT the OS keychain.
//
// On subsequent runs it reloads the persisted CA cert and re-injects it.
//
// Leaf cert issuance:
//   Users can request certs for domains like "localhost", "*.local", etc.
//   DevCertManager generates a leaf cert signed by the local CA for each.
//   Leaf certs are stored in ~/.guardhero/dev-certs/<domain>.pem.

#ifndef CHROME_BROWSER_GUARDHERO_DEV_CERT_MANAGER_H_
#define CHROME_BROWSER_GUARDHERO_DEV_CERT_MANAGER_H_

#include <memory>
#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "base/time/time.h"
#include "net/cert/x509_certificate.h"

namespace guardhero {

// Represents a locally issued certificate.
struct DevCertInfo {
  std::string domain;
  base::Time valid_from;
  base::Time valid_until;
  bool is_ca = false;
  std::string pem_path;  // Absolute path to the .pem file on disk
};

// Callback types.
using DevCertCallback =
    base::OnceCallback<void(bool success, const std::string& error_msg)>;
using DevCertListCallback =
    base::OnceCallback<void(std::vector<DevCertInfo> certs)>;

// DevCertManager — manages the DevMode local CA.
// One instance per browser profile (owned by a ProfileKeyedService).
class DevCertManager {
 public:
  explicit DevCertManager(const base::FilePath& profile_dir);
  ~DevCertManager();

  // ── CA lifecycle ─────────────────────────────────────────────────────────

  // Returns true if a local CA cert already exists on disk.
  bool HasCA() const;

  // Returns information about the current CA cert.
  DevCertInfo GetCAInfo() const;

  // Generates (or regenerates) the local CA cert.
  // If a CA already exists it is revoked and replaced.
  // Calls |callback| on the UI thread with the result.
  void GenerateCA(DevCertCallback callback);

  // Exports the CA cert PEM to the given path (for user download).
  bool ExportCA(const base::FilePath& dest_path) const;

  // ── Leaf cert management ─────────────────────────────────────────────────

  // Issues a leaf cert for |domain|, signed by the local CA.
  // Returns the cert info, or calls callback with an error on failure.
  void IssueCert(const std::string& domain, DevCertCallback callback);

  // Revokes a previously issued cert (marks it invalid on disk).
  bool RevokeCert(const std::string& domain);

  // Returns all issued leaf certs (not including the CA itself).
  void ListCerts(DevCertListCallback callback) const;

  // ── Trust injection ──────────────────────────────────────────────────────

  // Injects the local CA cert into the browser's CertVerifier so that HTTPS
  // connections to *.local / localhost (served by the local proxy) are trusted.
  // Called automatically after GenerateCA() completes.
  bool InjectCAIntoBrowserTrustStore();

  // ── Singleton per profile ────────────────────────────────────────────────
  static DevCertManager* GetForProfile(const base::FilePath& profile_dir);

 private:
  base::FilePath CertsDirectory() const;
  base::FilePath CAKeyPath() const;
  base::FilePath CACertPath() const;
  base::FilePath LeafCertPath(const std::string& domain) const;

  // Loads (or initialises) the persisted CA cert info from disk.
  void LoadCACertInfo();

  base::FilePath profile_dir_;
  DevCertInfo ca_info_;
  bool ca_loaded_ = false;

  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<DevCertManager> weak_factory_{this};

  DevCertManager(const DevCertManager&) = delete;
  DevCertManager& operator=(const DevCertManager&) = delete;
};

}  // namespace guardhero

#endif  // CHROME_BROWSER_GUARDHERO_DEV_CERT_MANAGER_H_
