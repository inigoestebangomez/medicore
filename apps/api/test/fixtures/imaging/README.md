# Synthetic Imaging Fixtures

These fixtures are deterministic, anonymized payloads for focused tests. They cover PNG, JPEG, WebP, PDF, MP4, MOV, ZIP, and DICOM MIME/extension handling.

They are intentionally not wired into the Prisma seed, database, or storage services. Tests may import the exported buffers and clean up any temporary files they create in their own scope.
