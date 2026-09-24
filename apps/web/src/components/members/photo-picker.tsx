"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "./member-avatar";

/** Pick or take a photo; the file is kept in memory until the member is saved. */
export function PhotoPicker({
  name,
  initialUrl,
  onChange,
}: {
  name: string;
  initialUrl?: string | null;
  onChange: (file: File | null) => void;
}) {
  const t = useTranslations("memberForm");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);

  return (
    <div className="flex items-center gap-4">
      <MemberAvatar name={name || "?"} photoUrl={preview} size={72} />
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          id="member-photo"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onChange(file);
            if (file) setPreview(URL.createObjectURL(file));
          }}
        />
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          <Camera /> {preview ? t("changePhoto") : t("choosePhoto")}
        </Button>
        <p className="text-xs text-muted">{t("photoHint")}</p>
      </div>
    </div>
  );
}
