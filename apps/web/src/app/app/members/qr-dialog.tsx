"use client";

import { useEffect, useState } from "react";
import { Copy, Download, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Shows the gym's public sign-up link as a QR code to print or share. */
export function QrDialog({ url }: { url: string }) {
  const t = useTranslations("members");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || dataUrl) return;
    // Dark modules on white: scanners read this reliably in both themes.
    QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#0E0F12", light: "#FFFFFF" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [open, url, dataUrl]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary">
          <QrCode /> {t("qrLink")}
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")}>
        <SheetTitle>{t("qrTitle")}</SheetTitle>
        <SheetDescription className="mt-1">{t("qrBody")}</SheetDescription>
        <div className="mt-5 flex flex-col items-center gap-4">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated data URL
            <img src={dataUrl} alt={t("qrTitle")} className="size-64 rounded-md bg-white p-2" />
          ) : (
            <div className="size-64 animate-pulse rounded-md bg-surface-2" />
          )}
          <p className="num w-full rounded-md bg-surface-2 px-3 py-2 text-center text-sm break-all">
            {url}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                toast.success(tc("copied"));
              }}
            >
              <Copy /> {tc("copy")}
            </Button>
            {dataUrl ? (
              <Button asChild>
                <a href={dataUrl} download="gymnode-qr.png">
                  <Download /> {t("qrDownload")}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
