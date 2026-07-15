import { getRequestConfig } from "next-intl/server";

const supported = new Set(["zh-CN", "en"]);

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && supported.has(requested) ? requested : "zh-CN";
  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
