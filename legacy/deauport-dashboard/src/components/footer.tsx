export default function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
        <div>© {new Date().getFullYear()} Deauport. All rights reserved.</div>
        <nav className="flex gap-4">
          <a
            href="https://deauport.id"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            deauport.id
          </a>
          <a
            href="https://github.com/J58C"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            GitHub
          </a>
          <a href="/privacy" className="hover:underline">
            Privacy
          </a>
        </nav>
      </div>
    </footer>
  );
}