import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, parseLocale } from "@/lib/preferences";

// No /bn or /en in URLs (PLAN.md §2.7): the language comes from the user's cookie
// (and from M1, their profile). Bangla is the default.
export default getRequestConfig(async () => {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return {
    locale,
    timeZone: "Asia/Dhaka",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
