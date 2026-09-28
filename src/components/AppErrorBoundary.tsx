import { Component, type ReactNode } from "react";

export default class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen bg-[#fff8ef] flex items-center justify-center p-6">
        <section
          role="alert"
          className="max-w-md bg-white border rounded-3xl p-8"
        >
          <p className="text-[var(--promise-berry)] font-semibold">Pinky Promise</p>
          <h1 className="text-2xl font-bold mt-4">
            This screen couldn’t load.
          </h1>
          <p className="text-gray-600 mt-3">
            Reload to try again. If you just submitted a payment or order, check
            its status before submitting another.
          </p>
          <button
            className="mt-6 bg-[var(--promise-berry)] text-white rounded-xl px-5 py-3"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
          <a className="ml-4 text-[#086874] underline" href="/staff/workspace">
            Staff workspace
          </a>
        </section>
      </main>
    );
  }
}
