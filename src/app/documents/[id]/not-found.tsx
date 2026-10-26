import Link from "next/link";

export default function DocumentNotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Document not available</h1>
      <p className="mt-2 text-sm text-slate-600">
        This document doesn&apos;t exist, or it hasn&apos;t been shared with you. Ask the owner to share it with your
        email address.
      </p>
      <Link href="/documents" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
        Back to documents
      </Link>
    </main>
  );
}
