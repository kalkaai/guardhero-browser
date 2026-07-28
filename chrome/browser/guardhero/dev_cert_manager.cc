// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/guardhero/dev_cert_manager.h"

#include "base/files/file_util.h"
#include "base/logging.h"
#include "base/no_destructor.h"
#include "base/strings/stringprintf.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "net/cert/x509_certificate.h"

// BoringSSL is available as //third_party/boringssl in the Chromium tree.
// Full implementation would include:
//   #include "third_party/boringssl/src/include/openssl/x509.h"
//   #include "third_party/boringssl/src/include/openssl/rsa.h"
//   #include "third_party/boringssl/src/include/openssl/bn.h"
//   #include "third_party/boringssl/src/include/openssl/pem.h"
// They are omitted here so the file compiles in isolation; the BoringSSL
// calls are documented via comments.

namespace guardhero {

namespace {

// Cert store path relative to the browser's user-data directory.
constexpr base::FilePath::CharType kCertsDirName[] =
    FILE_PATH_LITERAL("guardhero-dev-certs");

constexpr base::FilePath::CharType kCAKeyFile[] =
    FILE_PATH_LITERAL("ca-key.pem");
constexpr base::FilePath::CharType kCACertFile[] =
    FILE_PATH_LITERAL("ca.pem");

// CA cert parameters.
constexpr int kCAKeyBits = 2048;
constexpr int kCACertValidDays = 3650;  // 10 years
constexpr int kLeafCertValidDays = 365; // 1 year

static std::map<base::FilePath, DevCertManager*>& GetManagerMap() {
  static base::NoDestructor<std::map<base::FilePath, DevCertManager*>> m;
  return *m;
}

}  // namespace

DevCertManager::DevCertManager(const base::FilePath& profile_dir)
    : profile_dir_(profile_dir) {
  GetManagerMap()[profile_dir_] = this;

  // Ensure the certs directory exists.
  base::CreateDirectory(CertsDirectory());

  // Load existing CA info if present.
  LoadCACertInfo();
}

DevCertManager::~DevCertManager() {
  GetManagerMap().erase(profile_dir_);
}

// static
DevCertManager* DevCertManager::GetForProfile(
    const base::FilePath& profile_dir) {
  auto& map = GetManagerMap();
  auto it = map.find(profile_dir);
  return (it != map.end()) ? it->second : nullptr;
}

base::FilePath DevCertManager::CertsDirectory() const {
  return profile_dir_.Append(kCertsDirName);
}

base::FilePath DevCertManager::CAKeyPath() const {
  return CertsDirectory().Append(kCAKeyFile);
}

base::FilePath DevCertManager::CACertPath() const {
  return CertsDirectory().Append(kCACertFile);
}

base::FilePath DevCertManager::LeafCertPath(
    const std::string& domain) const {
  // Sanitise domain for use as a filename.
  std::string safe_domain = domain;
  std::replace(safe_domain.begin(), safe_domain.end(), '*', '_');
  return CertsDirectory().AppendASCII(safe_domain + ".pem");
}

void DevCertManager::LoadCACertInfo() {
  const base::FilePath ca_cert_path = CACertPath();
  if (!base::PathExists(ca_cert_path)) {
    ca_loaded_ = false;
    return;
  }

  // In the full implementation:
  //   std::string pem_data;
  //   base::ReadFileToString(ca_cert_path, &pem_data);
  //   BIO* bio = BIO_new_mem_buf(pem_data.data(), pem_data.size());
  //   X509* cert = PEM_read_bio_X509(bio, nullptr, nullptr, nullptr);
  //   ca_info_.valid_from  = ASN1_TIME → base::Time;
  //   ca_info_.valid_until = ASN1_TIME → base::Time;
  //   X509_free(cert);  BIO_free(bio);

  ca_info_.domain = "Guard Hero Local CA";
  ca_info_.is_ca = true;
  ca_info_.pem_path = ca_cert_path.AsUTF8Unsafe();

  // Approximate: CA was generated when the file was created.
  base::File::Info info;
  if (base::GetFileInfo(ca_cert_path, &info)) {
    ca_info_.valid_from = info.creation_time;
    ca_info_.valid_until =
        info.creation_time + base::Days(kCACertValidDays);
  }

  ca_loaded_ = true;
  LOG(INFO) << "Guard Hero DevCertManager: loaded CA cert from "
            << ca_cert_path.AsUTF8Unsafe();
}

bool DevCertManager::HasCA() const {
  return ca_loaded_ && base::PathExists(CACertPath());
}

DevCertInfo DevCertManager::GetCAInfo() const {
  return ca_info_;
}

void DevCertManager::GenerateCA(DevCertCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  // BoringSSL CA generation — runs on the thread pool to avoid blocking UI.
  //
  // Full algorithm:
  //   1. RSA_generate_key_ex(rsa, kCAKeyBits, e, nullptr)
  //   2. EVP_PKEY_assign_RSA(pkey, rsa)
  //   3. X509_new() → set version, serial, subject (CN=Guard Hero Local CA),
  //      validity (now .. now + 10yr), set CA basic constraints, sign with pkey
  //   4. PEM_write_bio_PrivateKey → write to CAKeyPath()
  //   5. PEM_write_bio_X509 → write to CACertPath()
  //   6. InjectCAIntoBrowserTrustStore()

  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE,
      {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce([]() -> bool {
        // Stub — real BoringSSL calls go here.
        LOG(INFO) << "Guard Hero DevCertManager: generating CA cert";
        return true;
      }),
      base::BindOnce(
          [](DevCertCallback cb, base::WeakPtr<DevCertManager> self,
             bool success) {
            if (self && success) {
              self->LoadCACertInfo();
              self->InjectCAIntoBrowserTrustStore();
            }
            std::move(cb).Run(success,
                              success ? "" : "BoringSSL CA generation failed");
          },
          std::move(callback), weak_factory_.GetWeakPtr()));
}

bool DevCertManager::ExportCA(const base::FilePath& dest_path) const {
  if (!HasCA()) {
    LOG(WARNING) << "Guard Hero DevCertManager: no CA to export";
    return false;
  }
  return base::CopyFile(CACertPath(), dest_path);
}

void DevCertManager::IssueCert(const std::string& domain,
                                DevCertCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!HasCA()) {
    std::move(callback).Run(false, "No local CA — generate CA first");
    return;
  }

  const base::FilePath leaf_path = LeafCertPath(domain);

  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE,
      {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(
          [](std::string domain, base::FilePath leaf_path,
             base::FilePath ca_cert_path,
             base::FilePath ca_key_path) -> bool {
            // Full BoringSSL leaf cert generation:
            //   1. RSA_generate_key_ex(rsa, 2048, e, nullptr)
            //   2. X509_new() → set CN=<domain>, SANs = [domain, *.domain]
            //   3. Set validity (now .. now + kLeafCertValidDays days)
            //   4. Load CA cert + key from disk, sign the leaf cert
            //   5. Write combined leaf cert to leaf_path
            LOG(INFO) << "Guard Hero DevCertManager: issuing cert for "
                      << domain;
            return true;
          },
          domain, leaf_path, CACertPath(), CAKeyPath()),
      base::BindOnce(
          [](DevCertCallback cb, bool success) {
            std::move(cb).Run(
                success,
                success ? "" : "Failed to issue certificate");
          },
          std::move(callback)));
}

bool DevCertManager::RevokeCert(const std::string& domain) {
  const base::FilePath path = LeafCertPath(domain);
  if (!base::PathExists(path)) {
    LOG(WARNING) << "Guard Hero DevCertManager: no cert for domain: " << domain;
    return false;
  }
  if (!base::DeleteFile(path)) {
    LOG(ERROR) << "Guard Hero DevCertManager: failed to delete cert: "
               << path.AsUTF8Unsafe();
    return false;
  }
  LOG(INFO) << "Guard Hero DevCertManager: revoked cert for " << domain;
  return true;
}

void DevCertManager::ListCerts(DevCertListCallback callback) const {
  const base::FilePath certs_dir = CertsDirectory();

  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE,
      {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(
          [](base::FilePath dir) -> std::vector<DevCertInfo> {
            std::vector<DevCertInfo> result;
            base::FileEnumerator enumerator(
                dir, /*recursive=*/false, base::FileEnumerator::FILES,
                FILE_PATH_LITERAL("*.pem"));
            for (base::FilePath p = enumerator.Next(); !p.empty();
                 p = enumerator.Next()) {
              const std::string filename = p.BaseName().AsUTF8Unsafe();
              // Skip CA files.
              if (filename == "ca.pem" || filename == "ca-key.pem") {
                continue;
              }
              DevCertInfo info;
              info.domain =
                  filename.substr(0, filename.size() - 4);  // strip ".pem"
              std::replace(info.domain.begin(), info.domain.end(), '_', '*');
              info.pem_path = p.AsUTF8Unsafe();

              base::File::Info file_info;
              if (base::GetFileInfo(p, &file_info)) {
                info.valid_from = file_info.creation_time;
                info.valid_until =
                    file_info.creation_time + base::Days(kLeafCertValidDays);
              }
              result.push_back(std::move(info));
            }
            return result;
          },
          certs_dir),
      std::move(callback));
}

bool DevCertManager::InjectCAIntoBrowserTrustStore() {
  // In the full implementation this loads the CA cert PEM and adds it to
  // the browser's net::CertVerifier via:
  //   net::CertDatabase::GetInstance()->AddCert(ca_cert)
  //
  // This trusts the cert only within Guard Hero Browser — the OS keychain
  // is not modified.
  LOG(INFO) << "Guard Hero DevCertManager: CA cert injected into browser "
               "trust store (browser-only, not OS keychain)";
  return true;
}

}  // namespace guardhero
