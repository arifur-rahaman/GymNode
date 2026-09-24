"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ImageUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { useErrorText } from "@/lib/use-error-text";
import { saveLogoPath } from "./actions";

export function LogoStep({ gymId }: { gymId: string }) {
  const t = useTranslations("onboarding");
  const errorText = useErrorText();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const blob = await compressImage(file, 512);
        // New file name each time so browsers and the CDN never show an old logo.
        const path = `${gymId}/logo-${Date.now()}.webp`;
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("gym-logos")
          .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (uploadError) throw uploadError;
        const result = await saveLogoPath(gymId, path);
        if (!result.ok) throw new Error(result.formError);
        setPreview(URL.createObjectURL(blob));
      } catch {
        setError("uploadFailed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-bold">{t("logoTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("logoHint")}</p>
      </div>
      <FormError message={errorText(error)} />
      <div className="flex items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote image
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImageUp className="size-8 text-muted" aria-hidden />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="logo-file"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? t("uploading") : preview ? t("changeLogo") : t("chooseLogo")}
        </Button>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button asChild variant="ghost">
          <Link href="/onboarding?step=packages">{t("skip")}</Link>
        </Button>
        <Button asChild>
          <Link href="/onboarding?step=packages">{t("next")}</Link>
        </Button>
      </div>
    </div>
  );
}
