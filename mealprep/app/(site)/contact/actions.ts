"use server";
import { redirect } from "next/navigation";
import { createEnquiry } from "@/lib/site";

const field = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function submitEnquiry(fd: FormData) {
  // Honeypot: real visitors never see or fill this field.
  if (field(fd, "company")) redirect("/contact?sent=1");
  const e = {
    name: field(fd, "name", 120), email: field(fd, "email", 160), phone: field(fd, "phone", 40),
    suburb: field(fd, "suburb", 120), interest: field(fd, "interest", 60), message: field(fd, "message", 2000),
  };
  const fail = (msg: string) => redirect(`/contact?error=${encodeURIComponent(msg)}`);
  if (!e.name) fail("Please tell us your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email) && !e.phone) fail("Please leave an email address or phone number so we can reply.");
  if (fd.get("consent") !== "on") fail("Please agree to us contacting you about your enquiry.");
  createEnquiry(e);
  redirect("/contact?sent=1");
}
