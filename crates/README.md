# Rust Components

This directory is reserved for measured system or compute workloads.

A crate must not be added until it has:

1. A named product consumer.
2. A measurable performance, security, or portability requirement.
3. A benchmark against the TypeScript or Go implementation.
4. A documented build and release path.

Likely future candidates include client-side hashing, archive inspection, and
cryptographic helpers for Drop. The Pulse agent remains Go.
