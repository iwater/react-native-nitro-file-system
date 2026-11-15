#pragma once

#include <algorithm>
#include <array>
#include <cctype>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#ifdef __APPLE__
#include <CommonCrypto/CommonDigest.h>
#endif

namespace nitro {
namespace fs {

class StreamingHasher {
public:
  enum class Algorithm { MD5, SHA1, SHA256, SHA512 };

  static bool parseAlgorithm(const std::string &name, Algorithm &out) {
    std::string lower;
    lower.reserve(name.size());
    for (unsigned char c : name) {
      lower.push_back(static_cast<char>(std::tolower(c)));
    }
    if (lower == "md5") {
      out = Algorithm::MD5;
      return true;
    }
    if (lower == "sha1" || lower == "sha-1") {
      out = Algorithm::SHA1;
      return true;
    }
    if (lower == "sha256" || lower == "sha-256") {
      out = Algorithm::SHA256;
      return true;
    }
    if (lower == "sha512" || lower == "sha-512") {
      out = Algorithm::SHA512;
      return true;
    }
    return false;
  }

  static bool isSupported(const std::string &name) {
    Algorithm dummy;
    return parseAlgorithm(name, dummy);
  }

  explicit StreamingHasher(const std::string &name) {
    if (!parseAlgorithm(name, algo_)) {
      throw std::invalid_argument("Unsupported hash algorithm: " + name);
    }
    init();
  }

  void update(const uint8_t *data, size_t len) {
    if (len == 0)
      return;
#ifdef __APPLE__
    switch (algo_) {
    case Algorithm::MD5:
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      CC_MD5_Update(&md5Ctx_, data, static_cast<CC_LONG>(len));
#pragma clang diagnostic pop
      break;
    case Algorithm::SHA1:
      CC_SHA1_Update(&sha1Ctx_, data, static_cast<CC_LONG>(len));
      break;
    case Algorithm::SHA256:
      CC_SHA256_Update(&sha256Ctx_, data, static_cast<CC_LONG>(len));
      break;
    case Algorithm::SHA512:
      CC_SHA512_Update(&sha512Ctx_, data, static_cast<CC_LONG>(len));
      break;
    }
#else
    switch (algo_) {
    case Algorithm::MD5:
      md5Update(data, len);
      break;
    case Algorithm::SHA1:
      sha1Update(data, len);
      break;
    case Algorithm::SHA256:
      sha256Update(data, len);
      break;
    case Algorithm::SHA512:
      sha512Update(data, len);
      break;
    }
#endif
  }

  std::string finalizeHex() {
    std::vector<uint8_t> digest;
#ifdef __APPLE__
    switch (algo_) {
    case Algorithm::MD5: {
      digest.resize(CC_MD5_DIGEST_LENGTH);
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      CC_MD5_Final(digest.data(), &md5Ctx_);
#pragma clang diagnostic pop
      break;
    }
    case Algorithm::SHA1: {
      digest.resize(CC_SHA1_DIGEST_LENGTH);
      CC_SHA1_Final(digest.data(), &sha1Ctx_);
      break;
    }
    case Algorithm::SHA256: {
      digest.resize(CC_SHA256_DIGEST_LENGTH);
      CC_SHA256_Final(digest.data(), &sha256Ctx_);
      break;
    }
    case Algorithm::SHA512: {
      digest.resize(CC_SHA512_DIGEST_LENGTH);
      CC_SHA512_Final(digest.data(), &sha512Ctx_);
      break;
    }
    }
#else
    switch (algo_) {
    case Algorithm::MD5:
      digest = md5Final();
      break;
    case Algorithm::SHA1:
      digest = sha1Final();
      break;
    case Algorithm::SHA256:
      digest = sha256Final();
      break;
    case Algorithm::SHA512:
      digest = sha512Final();
      break;
    }
#endif
    static constexpr char kHex[] = "0123456789abcdef";
    std::string out;
    out.reserve(digest.size() * 2);
    for (uint8_t b : digest) {
      out.push_back(kHex[(b >> 4) & 0x0f]);
      out.push_back(kHex[b & 0x0f]);
    }
    return out;
  }

private:
  Algorithm algo_;

#ifdef __APPLE__
  CC_MD5_CTX md5Ctx_{};
  CC_SHA1_CTX sha1Ctx_{};
  CC_SHA256_CTX sha256Ctx_{};
  CC_SHA512_CTX sha512Ctx_{};

  void init() {
    switch (algo_) {
    case Algorithm::MD5:
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      CC_MD5_Init(&md5Ctx_);
#pragma clang diagnostic pop
      break;
    case Algorithm::SHA1:
      CC_SHA1_Init(&sha1Ctx_);
      break;
    case Algorithm::SHA256:
      CC_SHA256_Init(&sha256Ctx_);
      break;
    case Algorithm::SHA512:
      CC_SHA512_Init(&sha512Ctx_);
      break;
    }
  }
#else
  // Portable C++ implementations for Android / Linux / non-Apple POSIX

  void init() {
    switch (algo_) {
    case Algorithm::MD5:
      md5Init();
      break;
    case Algorithm::SHA1:
      sha1Init();
      break;
    case Algorithm::SHA256:
      sha256Init();
      break;
    case Algorithm::SHA512:
      sha512Init();
      break;
    }
  }

  static inline uint32_t rotl32(uint32_t x, uint32_t n) {
    return (x << n) | (x >> (32 - n));
  }
  static inline uint32_t rotr32(uint32_t x, uint32_t n) {
    return (x >> n) | (x << (32 - n));
  }
  static inline uint64_t rotr64(uint64_t x, uint64_t n) {
    return (x >> n) | (x << (64 - n));
  }

  // --- MD5 ---
  uint32_t md5State_[4]{};
  uint64_t md5Count_ = 0;
  uint8_t md5Buf_[64]{};

  void md5Init() {
    md5Count_ = 0;
    md5State_[0] = 0x67452301u;
    md5State_[1] = 0xefcdab89u;
    md5State_[2] = 0x98badcfeu;
    md5State_[3] = 0x10325476u;
  }

  void md5Transform(const uint8_t block[64]) {
    static constexpr uint32_t k[64] = {
        0xd76aa478u, 0xe8c7b756u, 0x242070dbu, 0xc1bdceeeu, 0xf57c0fafu,
        0x4787c62au, 0xa8304613u, 0xfd469501u, 0x698098d8u, 0x8b44f7afu,
        0xffff5bb1u, 0x895cd7beu, 0x6b901122u, 0xfd987193u, 0xa679438eu,
        0x49b40821u, 0xf61e2562u, 0xc040b340u, 0x265e5a51u, 0xe9b6c7aau,
        0xd62f105du, 0x02441453u, 0xd8a1e681u, 0xe7d3fbc8u, 0x21e1cde6u,
        0xc33707d6u, 0xf4d50d87u, 0x455a14edu, 0xa9e3e905u, 0xfcefa3f8u,
        0x676f02d9u, 0x8d2a4c8au, 0xfffa3942u, 0x8771f681u, 0x6d9d6122u,
        0xfde5380cu, 0xa4beea44u, 0x4bdecfa9u, 0xf6bb4b60u, 0xbebfbc70u,
        0x289b7ec6u, 0xeaa127fau, 0xd4ef3085u, 0x04881d05u, 0xd9d4d039u,
        0xe6db99e5u, 0x1fa27cf8u, 0xc4ac5665u, 0xf4292244u, 0x432aff97u,
        0xab9423a7u, 0xfc93a039u, 0x655b59c3u, 0x8f0ccc92u, 0xffeff47du,
        0x85845dd1u, 0x6fa87e4fu, 0xfe2ce6e0u, 0xa3014314u, 0x4e0811a1u,
        0xf7537e82u, 0xbd3af235u, 0x2ad7d2bbu, 0xeb86d391u};
    static constexpr uint32_t s[64] = {
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9,  14, 20, 5, 9,  14, 20, 5, 9,  14, 20, 5, 9,  14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21};

    uint32_t m[16];
    for (int i = 0; i < 16; ++i) {
      m[i] = static_cast<uint32_t>(block[i * 4]) |
             (static_cast<uint32_t>(block[i * 4 + 1]) << 8) |
             (static_cast<uint32_t>(block[i * 4 + 2]) << 16) |
             (static_cast<uint32_t>(block[i * 4 + 3]) << 24);
    }

    uint32_t a = md5State_[0];
    uint32_t b = md5State_[1];
    uint32_t c = md5State_[2];
    uint32_t d = md5State_[3];

    for (uint32_t i = 0; i < 64; ++i) {
      uint32_t f, g;
      if (i < 16) {
        f = (b & c) | ((~b) & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | ((~d) & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | (~d));
        g = (7 * i) % 16;
      }
      uint32_t temp = d;
      d = c;
      c = b;
      b = b + rotl32(a + f + k[i] + m[g], s[i]);
      a = temp;
    }

    md5State_[0] += a;
    md5State_[1] += b;
    md5State_[2] += c;
    md5State_[3] += d;
  }

  void md5Update(const uint8_t *data, size_t len) {
    size_t idx = static_cast<size_t>(md5Count_ % 64);
    md5Count_ += len;
    size_t i = 0;
    if (idx > 0) {
      size_t fill = 64 - idx;
      if (len < fill) {
        std::memcpy(md5Buf_ + idx, data, len);
        return;
      }
      std::memcpy(md5Buf_ + idx, data, fill);
      md5Transform(md5Buf_);
      i += fill;
    }
    while (i + 64 <= len) {
      md5Transform(data + i);
      i += 64;
    }
    if (i < len) {
      std::memcpy(md5Buf_, data + i, len - i);
    }
  }

  std::vector<uint8_t> md5Final() {
    uint64_t bitLen = md5Count_ * 8;
    uint8_t pad = 0x80;
    md5Update(&pad, 1);
    uint8_t zero = 0x00;
    while (md5Count_ % 64 != 56) {
      md5Update(&zero, 1);
    }
    uint8_t lenBytes[8];
    for (int i = 0; i < 8; ++i) {
      lenBytes[i] = static_cast<uint8_t>((bitLen >> (i * 8)) & 0xff);
    }
    md5Update(lenBytes, 8);
    std::vector<uint8_t> out(16);
    for (int i = 0; i < 4; ++i) {
      out[i * 4] = static_cast<uint8_t>(md5State_[i] & 0xff);
      out[i * 4 + 1] = static_cast<uint8_t>((md5State_[i] >> 8) & 0xff);
      out[i * 4 + 2] = static_cast<uint8_t>((md5State_[i] >> 16) & 0xff);
      out[i * 4 + 3] = static_cast<uint8_t>((md5State_[i] >> 24) & 0xff);
    }
    return out;
  }

  // --- SHA-1 ---
  uint32_t sha1State_[5]{};
  uint64_t sha1Count_ = 0;
  uint8_t sha1Buf_[64]{};

  void sha1Init() {
    sha1Count_ = 0;
    sha1State_[0] = 0x67452301u;
    sha1State_[1] = 0xefcdab89u;
    sha1State_[2] = 0x98badcfeu;
    sha1State_[3] = 0x10325476u;
    sha1State_[4] = 0xc3d2e1f0u;
  }

  void sha1Transform(const uint8_t block[64]) {
    uint32_t w[80];
    for (int i = 0; i < 16; ++i) {
      w[i] = (static_cast<uint32_t>(block[i * 4]) << 24) |
             (static_cast<uint32_t>(block[i * 4 + 1]) << 16) |
             (static_cast<uint32_t>(block[i * 4 + 2]) << 8) |
             static_cast<uint32_t>(block[i * 4 + 3]);
    }
    for (int i = 16; i < 80; ++i) {
      w[i] = rotl32(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    uint32_t a = sha1State_[0];
    uint32_t b = sha1State_[1];
    uint32_t c = sha1State_[2];
    uint32_t d = sha1State_[3];
    uint32_t e = sha1State_[4];
    for (int i = 0; i < 80; ++i) {
      uint32_t f, k;
      if (i < 20) {
        f = (b & c) | ((~b) & d);
        k = 0x5a827999u;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1u;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdcu;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6u;
      }
      uint32_t temp = rotl32(a, 5) + f + e + k + w[i];
      e = d;
      d = c;
      c = rotl32(b, 30);
      b = a;
      a = temp;
    }
    sha1State_[0] += a;
    sha1State_[1] += b;
    sha1State_[2] += c;
    sha1State_[3] += d;
    sha1State_[4] += e;
  }

  void sha1Update(const uint8_t *data, size_t len) {
    size_t idx = static_cast<size_t>(sha1Count_ % 64);
    sha1Count_ += len;
    size_t i = 0;
    if (idx > 0) {
      size_t fill = 64 - idx;
      if (len < fill) {
        std::memcpy(sha1Buf_ + idx, data, len);
        return;
      }
      std::memcpy(sha1Buf_ + idx, data, fill);
      sha1Transform(sha1Buf_);
      i += fill;
    }
    while (i + 64 <= len) {
      sha1Transform(data + i);
      i += 64;
    }
    if (i < len) {
      std::memcpy(sha1Buf_, data + i, len - i);
    }
  }

  std::vector<uint8_t> sha1Final() {
    uint64_t bitLen = sha1Count_ * 8;
    uint8_t pad = 0x80;
    sha1Update(&pad, 1);
    uint8_t zero = 0x00;
    while (sha1Count_ % 64 != 56) {
      sha1Update(&zero, 1);
    }
    uint8_t lenBytes[8];
    for (int i = 0; i < 8; ++i) {
      lenBytes[i] = static_cast<uint8_t>((bitLen >> ((7 - i) * 8)) & 0xff);
    }
    sha1Update(lenBytes, 8);
    std::vector<uint8_t> out(20);
    for (int i = 0; i < 5; ++i) {
      out[i * 4] = static_cast<uint8_t>((sha1State_[i] >> 24) & 0xff);
      out[i * 4 + 1] = static_cast<uint8_t>((sha1State_[i] >> 16) & 0xff);
      out[i * 4 + 2] = static_cast<uint8_t>((sha1State_[i] >> 8) & 0xff);
      out[i * 4 + 3] = static_cast<uint8_t>(sha1State_[i] & 0xff);
    }
    return out;
  }

  // --- SHA-256 ---
  uint32_t sha256State_[8]{};
  uint64_t sha256Count_ = 0;
  uint8_t sha256Buf_[64]{};

  void sha256Init() {
    sha256Count_ = 0;
    sha256State_[0] = 0x6a09e667u;
    sha256State_[1] = 0xbb67ae85u;
    sha256State_[2] = 0x3c6ef372u;
    sha256State_[3] = 0xa54ff53au;
    sha256State_[4] = 0x510e527fu;
    sha256State_[5] = 0x9b05688cu;
    sha256State_[6] = 0x1f83d9abu;
    sha256State_[7] = 0x5be0cd19u;
  }

  void sha256Transform(const uint8_t block[64]) {
    static constexpr uint32_t k[64] = {
        0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu,
        0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u, 0xd807aa98u, 0x12835b01u,
        0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u,
        0xc19bf174u, 0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
        0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau, 0x983e5152u,
        0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u,
        0x06ca6351u, 0x14292967u, 0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu,
        0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
        0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u,
        0xd6990624u, 0xf40e3585u, 0x106aa070u, 0x19a4c116u, 0x1e376c08u,
        0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu,
        0x682e6ff3u, 0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
        0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u};
    uint32_t w[64];
    for (int i = 0; i < 16; ++i) {
      w[i] = (static_cast<uint32_t>(block[i * 4]) << 24) |
             (static_cast<uint32_t>(block[i * 4 + 1]) << 16) |
             (static_cast<uint32_t>(block[i * 4 + 2]) << 8) |
             static_cast<uint32_t>(block[i * 4 + 3]);
    }
    for (int i = 16; i < 64; ++i) {
      uint32_t s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >> 3);
      uint32_t s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint32_t a = sha256State_[0];
    uint32_t b = sha256State_[1];
    uint32_t c = sha256State_[2];
    uint32_t d = sha256State_[3];
    uint32_t e = sha256State_[4];
    uint32_t f = sha256State_[5];
    uint32_t g = sha256State_[6];
    uint32_t h = sha256State_[7];
    for (int i = 0; i < 64; ++i) {
      uint32_t S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      uint32_t ch = (e & f) ^ ((~e) & g);
      uint32_t temp1 = h + S1 + ch + k[i] + w[i];
      uint32_t S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
      uint32_t temp2 = S0 + maj;
      h = g;
      g = f;
      f = e;
      e = d + temp1;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2;
    }
    sha256State_[0] += a;
    sha256State_[1] += b;
    sha256State_[2] += c;
    sha256State_[3] += d;
    sha256State_[4] += e;
    sha256State_[5] += f;
    sha256State_[6] += g;
    sha256State_[7] += h;
  }

  void sha256Update(const uint8_t *data, size_t len) {
    size_t idx = static_cast<size_t>(sha256Count_ % 64);
    sha256Count_ += len;
    size_t i = 0;
    if (idx > 0) {
      size_t fill = 64 - idx;
      if (len < fill) {
        std::memcpy(sha256Buf_ + idx, data, len);
        return;
      }
      std::memcpy(sha256Buf_ + idx, data, fill);
      sha256Transform(sha256Buf_);
      i += fill;
    }
    while (i + 64 <= len) {
      sha256Transform(data + i);
      i += 64;
    }
    if (i < len) {
      std::memcpy(sha256Buf_, data + i, len - i);
    }
  }

  std::vector<uint8_t> sha256Final() {
    uint64_t bitLen = sha256Count_ * 8;
    uint8_t pad = 0x80;
    sha256Update(&pad, 1);
    uint8_t zero = 0x00;
    while (sha256Count_ % 64 != 56) {
      sha256Update(&zero, 1);
    }
    uint8_t lenBytes[8];
    for (int i = 0; i < 8; ++i) {
      lenBytes[i] = static_cast<uint8_t>((bitLen >> ((7 - i) * 8)) & 0xff);
    }
    sha256Update(lenBytes, 8);
    std::vector<uint8_t> out(32);
    for (int i = 0; i < 8; ++i) {
      out[i * 4] = static_cast<uint8_t>((sha256State_[i] >> 24) & 0xff);
      out[i * 4 + 1] = static_cast<uint8_t>((sha256State_[i] >> 16) & 0xff);
      out[i * 4 + 2] = static_cast<uint8_t>((sha256State_[i] >> 8) & 0xff);
      out[i * 4 + 3] = static_cast<uint8_t>(sha256State_[i] & 0xff);
    }
    return out;
  }

  // --- SHA-512 ---
  uint64_t sha512State_[8]{};
  uint64_t sha512CountLow_ = 0;
  uint64_t sha512CountHigh_ = 0;
  uint8_t sha512Buf_[128]{};

  void sha512Init() {
    sha512CountLow_ = 0;
    sha512CountHigh_ = 0;
    sha512State_[0] = 0x6a09e667f3bcc908ULL;
    sha512State_[1] = 0xbb67ae8584caa73bULL;
    sha512State_[2] = 0x3c6ef372fe94f82bULL;
    sha512State_[3] = 0xa54ff53a5f1d36f1ULL;
    sha512State_[4] = 0x510e527fade682d1ULL;
    sha512State_[5] = 0x9b05688c2b3e6c1fULL;
    sha512State_[6] = 0x1f83d9abfb41bd6bULL;
    sha512State_[7] = 0x5be0cd19137e2179ULL;
  }

  void sha512Transform(const uint8_t block[128]) {
    static constexpr uint64_t k[80] = {
        0x428a2f98d728ae22ULL, 0x7137449123ef65cdULL, 0xb5c0fbcfec4d3b2fULL,
        0xe9b5dba58189dbbcULL, 0x3956c25bf348b538ULL, 0x59f111f1b605d019ULL,
        0x923f82a4af194f9bULL, 0xab1c5ed5da6d8118ULL, 0xd807aa98a3030242ULL,
        0x12835b0145706fbeULL, 0x243185be4ee4b28cULL, 0x550c7dc3d5ffb4e2ULL,
        0x72be5d74f27b896fULL, 0x80deb1fe3b1696b1ULL, 0x9bdc06a725c71235ULL,
        0xc19bf174cf692694ULL, 0xe49b69c19ef14ad2ULL, 0xefbe4786384f25e3ULL,
        0x0fc19dc68b8cd5b5ULL, 0x240ca1cc77ac9c65ULL, 0x2de92c6f592b0275ULL,
        0x4a7484aa6ea6e483ULL, 0x5cb0a9dcbd41fbd4ULL, 0x76f988da831153b5ULL,
        0x983e5152ee66dfabULL, 0xa831c66d2db43210ULL, 0xb00327c898fb213fULL,
        0xbf597fc7beef0ee4ULL, 0xc6e00bf33da88fc2ULL, 0xd5a79147930aa725ULL,
        0x06ca6351e003826fULL, 0x142929670a0e6e70ULL, 0x27b70a8546d22ffcULL,
        0x2e1b21385c26c926ULL, 0x4d2c6dfc5ac42aedULL, 0x53380d139d95b3dfULL,
        0x650a73548baf63deULL, 0x766a0abb3c77b2a8ULL, 0x81c2c92e47edaee6ULL,
        0x92722c851482353bULL, 0xa2bfe8a14cf10364ULL, 0xa81a664bbc423001ULL,
        0xc24b8b70d0f89791ULL, 0xc76c51a30654be30ULL, 0xd192e819d6ef5218ULL,
        0xd69906245565a910ULL, 0xf40e35855771202aULL, 0x106aa07032bbd1b8ULL,
        0x19a4c116b8d2d0c8ULL, 0x1e376c085141ab53ULL, 0x2748774cdf8eeb99ULL,
        0x34b0bcb5e19b48a8ULL, 0x391c0cb3c5c95a63ULL, 0x4ed8aa4ae3418acbULL,
        0x5b9cca4f7763e373ULL, 0x682e6ff3d6b2b8a3ULL, 0x748f82ee5defb2fcULL,
        0x78a5636f43172f60ULL, 0x84c87814a1f0ab72ULL, 0x8cc702081a6439ecULL,
        0x90befffa23631e28ULL, 0xa4506cebde82bde9ULL, 0xbef9a3f7b2c67915ULL,
        0xc67178f2e372532bULL, 0xca273eceea26619cULL, 0xd186b8c721c0c207ULL,
        0xeada7dd6cde0eb1eULL, 0xf57d4f7fee6ed178ULL, 0x06f067aa72176fbaULL,
        0x0a637dc5a2c898a6ULL, 0x113f9804bef90daeULL, 0x1b710b35131c471bULL,
        0x28db77f523047d84ULL, 0x32caab7b40c72493ULL, 0x3c9ebe0a15c9bebcULL,
        0x431d67c49c100d4cULL, 0x4cc5d4becb3e42b6ULL, 0x597f299cfc657e2aULL,
        0x5fcb6fab3ad6faecULL, 0x6c44198c4a475817ULL};
    uint64_t w[80];
    for (int i = 0; i < 16; ++i) {
      w[i] = (static_cast<uint64_t>(block[i * 8]) << 56) |
             (static_cast<uint64_t>(block[i * 8 + 1]) << 48) |
             (static_cast<uint64_t>(block[i * 8 + 2]) << 40) |
             (static_cast<uint64_t>(block[i * 8 + 3]) << 32) |
             (static_cast<uint64_t>(block[i * 8 + 4]) << 24) |
             (static_cast<uint64_t>(block[i * 8 + 5]) << 16) |
             (static_cast<uint64_t>(block[i * 8 + 6]) << 8) |
             static_cast<uint64_t>(block[i * 8 + 7]);
    }
    for (int i = 16; i < 80; ++i) {
      uint64_t s0 = rotr64(w[i - 15], 1) ^ rotr64(w[i - 15], 8) ^ (w[i - 15] >> 7);
      uint64_t s1 = rotr64(w[i - 2], 19) ^ rotr64(w[i - 2], 61) ^ (w[i - 2] >> 6);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    uint64_t a = sha512State_[0];
    uint64_t b = sha512State_[1];
    uint64_t c = sha512State_[2];
    uint64_t d = sha512State_[3];
    uint64_t e = sha512State_[4];
    uint64_t f = sha512State_[5];
    uint64_t g = sha512State_[6];
    uint64_t h = sha512State_[7];
    for (int i = 0; i < 80; ++i) {
      uint64_t S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
      uint64_t ch = (e & f) ^ ((~e) & g);
      uint64_t temp1 = h + S1 + ch + k[i] + w[i];
      uint64_t S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
      uint64_t maj = (a & b) ^ (a & c) ^ (b & c);
      uint64_t temp2 = S0 + maj;
      h = g;
      g = f;
      f = e;
      e = d + temp1;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2;
    }
    sha512State_[0] += a;
    sha512State_[1] += b;
    sha512State_[2] += c;
    sha512State_[3] += d;
    sha512State_[4] += e;
    sha512State_[5] += f;
    sha512State_[6] += g;
    sha512State_[7] += h;
  }

  void sha512Update(const uint8_t *data, size_t len) {
    size_t idx = static_cast<size_t>(sha512CountLow_ % 128);
    uint64_t oldLow = sha512CountLow_;
    sha512CountLow_ += static_cast<uint64_t>(len);
    if (sha512CountLow_ < oldLow) {
      sha512CountHigh_++;
    }
    size_t i = 0;
    if (idx > 0) {
      size_t fill = 128 - idx;
      if (len < fill) {
        std::memcpy(sha512Buf_ + idx, data, len);
        return;
      }
      std::memcpy(sha512Buf_ + idx, data, fill);
      sha512Transform(sha512Buf_);
      i += fill;
    }
    while (i + 128 <= len) {
      sha512Transform(data + i);
      i += 128;
    }
    if (i < len) {
      std::memcpy(sha512Buf_, data + i, len - i);
    }
  }

  std::vector<uint8_t> sha512Final() {
    uint64_t bitLow = sha512CountLow_ << 3;
    uint64_t bitHigh = (sha512CountHigh_ << 3) | (sha512CountLow_ >> 61);
    uint8_t pad = 0x80;
    sha512Update(&pad, 1);
    uint8_t zero = 0x00;
    while (sha512CountLow_ % 128 != 112) {
      sha512Update(&zero, 1);
    }
    uint8_t lenBytes[16];
    for (int i = 0; i < 8; ++i) {
      lenBytes[i] = static_cast<uint8_t>((bitHigh >> ((7 - i) * 8)) & 0xff);
      lenBytes[8 + i] = static_cast<uint8_t>((bitLow >> ((7 - i) * 8)) & 0xff);
    }
    sha512Update(lenBytes, 16);
    std::vector<uint8_t> out(64);
    for (int i = 0; i < 8; ++i) {
      out[i * 8] = static_cast<uint8_t>((sha512State_[i] >> 56) & 0xff);
      out[i * 8 + 1] = static_cast<uint8_t>((sha512State_[i] >> 48) & 0xff);
      out[i * 8 + 2] = static_cast<uint8_t>((sha512State_[i] >> 40) & 0xff);
      out[i * 8 + 3] = static_cast<uint8_t>((sha512State_[i] >> 32) & 0xff);
      out[i * 8 + 4] = static_cast<uint8_t>((sha512State_[i] >> 24) & 0xff);
      out[i * 8 + 5] = static_cast<uint8_t>((sha512State_[i] >> 16) & 0xff);
      out[i * 8 + 6] = static_cast<uint8_t>((sha512State_[i] >> 8) & 0xff);
      out[i * 8 + 7] = static_cast<uint8_t>(sha512State_[i] & 0xff);
    }
    return out;
  }
#endif
};

} // namespace fs
} // namespace nitro

