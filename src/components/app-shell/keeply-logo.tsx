import Image from "next/image";
import { cn } from "@/lib/utils";

const SOURCE_WIDTH = 1448;
const SOURCE_HEIGHT = 1086;

type BrandCrop = {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

const lockups = {
  "zh-CN": { src: "/brand/keeply-lockup-zh.png", left: 301, top: 330, width: 872, height: 417 },
  en: { src: "/brand/keeply-lockup-en.png", left: 204, top: 322, width: 1111, height: 412 },
} satisfies Record<"zh-CN" | "en", BrandCrop>;

const wordmarks = {
  "zh-CN": { src: "/brand/keeply-wordmark-zh.png", left: 330, top: 333, width: 817, height: 395 },
  en: { src: "/brand/keeply-wordmark-en.png", left: 249, top: 358, width: 1002, height: 339 },
} satisfies Record<"zh-CN" | "en", BrandCrop>;

const mark = { src: "/brand/keeply-lockup-zh.png", left: 270, top: 340, width: 397, height: 397 } satisfies BrandCrop;

export function KeeplyMark({ className }: { className?: string }) {
  return <CroppedBrandImage alt="" className={cn("size-8", className)} crop={mark} sizes="40px" />;
}

export function KeeplyLogo({ locale, className }: { locale: string; className?: string }) {
  const language = locale === "en" ? "en" : "zh-CN";

  if (language === "en") {
    return (
      <CroppedBrandImage
        alt="Keeply"
        className={cn("h-12", className)}
        crop={lockups.en}
        loading="eager"
        sizes="(min-width: 768px) 180px, 160px"
      />
    );
  }

  return (
    <span className={cn("flex h-12 items-center", className)}>
      <CroppedBrandImage
        alt="物序"
        className="h-full"
        crop={lockups["zh-CN"]}
        loading="eager"
        sizes="(min-width: 768px) 120px, 110px"
      />
      <CroppedBrandImage
        alt="Keeply"
        className="ml-2 h-[46%]"
        crop={wordmarks.en}
        loading="eager"
        sizes="90px"
      />
    </span>
  );
}

function CroppedBrandImage({
  alt,
  className,
  crop,
  loading,
  sizes,
}: {
  alt: string;
  className?: string;
  crop: BrandCrop;
  loading?: "eager" | "lazy";
  sizes: string;
}) {
  return (
    <span
      className={cn("pointer-events-none relative block shrink-0 overflow-hidden", className)}
      style={{ aspectRatio: `${crop.width} / ${crop.height}` }}
    >
      <Image
        alt={alt}
        className="absolute max-w-none select-none mix-blend-multiply dark:invert dark:mix-blend-screen"
        draggable={false}
        height={SOURCE_HEIGHT}
        loading={loading}
        sizes={sizes}
        src={crop.src}
        style={{
          height: "auto",
          left: `${(-crop.left / crop.width) * 100}%`,
          top: `${(-crop.top / crop.height) * 100}%`,
          width: `${(SOURCE_WIDTH / crop.width) * 100}%`,
        }}
        width={SOURCE_WIDTH}
      />
    </span>
  );
}
