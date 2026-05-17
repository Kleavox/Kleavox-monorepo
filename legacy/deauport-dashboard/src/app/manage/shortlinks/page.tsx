import ManageHeaderClient from "../header-client";
import Section from "./section-client";
import { AdminSidebar } from "../admin-sidebar";

export const metadata = { title: "Manage — Shortlinks" };

export default async function Page() {
  return (
    <>
      <ManageHeaderClient current="shortlinks" />
      <div className="mx-auto max-w-7xl px-4 pt-3">
        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          <main>
            <Section />
          </main>
          <AdminSidebar />
        </div>
      </div>
    </>
  );
}