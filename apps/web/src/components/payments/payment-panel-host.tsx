"use client";

import { useEffect, useState } from "react";
import { WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PaymentMember } from "@/app/app/payments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { IsoDate } from "@gymnode/core";
import type { PackageOption } from "./payment-fields";
import { TakePaymentPanel } from "./take-payment-panel";

type Props = {
  packages: PackageOption[];
  today: IsoDate;
  gymName: string;
  siteUrl: string;
  initialMember: PaymentMember | null;
};

function useIsDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 75rem)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

/** Take-payment panel: a side card on desktop (≥1200px), a full-screen sheet on smaller screens. */
export function PaymentPanelHost(props: Props) {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(!!props.initialMember);

  if (desktop === null) return null;
  if (desktop) {
    return (
      <Card className="sticky top-6 self-start" data-testid="take-payment">
        <CardHeader>
          <CardTitle>{t("take")}</CardTitle>
        </CardHeader>
        <TakePaymentPanel {...props} />
      </Card>
    );
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="fixed right-4 bottom-20 z-20 shadow-lg md:static md:self-start md:shadow-none">
          <WalletCards /> {t("take")}
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
        <SheetTitle>{t("take")}</SheetTitle>
        <div className="mt-5" data-testid="take-payment">
          <TakePaymentPanel {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
