"use client";

import { useEffect, useState } from "react";
import { ProductWizard } from "@/components/ProductWizard";
import { KOSZULKER_IMPORT_STORAGE_KEY } from "@/components/KoszulkerImportPanel";
import type { ProductFormInput } from "@/lib/product/types";

interface NewProductClientProps {
  serverInitialProduct?: ProductFormInput;
  subtitle?: string;
}

export function NewProductClient({
  serverInitialProduct,
  subtitle: initialSubtitle,
}: NewProductClientProps) {
  const [initialProduct, setInitialProduct] = useState<ProductFormInput | undefined>(
    serverInitialProduct,
  );
  const [subtitle, setSubtitle] = useState(
    initialSubtitle ?? "Uzupełnij dane, sprawdź payload i wyślij do Apilo (lub użyj dry-run).",
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "koszulker") {
      return;
    }

    const raw = sessionStorage.getItem(KOSZULKER_IMPORT_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const imported = JSON.parse(raw) as ProductFormInput;
      setInitialProduct(imported);
      setSubtitle(
        `Zaimportowano z Koszulker: ${imported.groupName}. Sprawdź kategorię, EAN i zdjęcia przed wysyłką.`,
      );
      sessionStorage.removeItem(KOSZULKER_IMPORT_STORAGE_KEY);
    } catch {
      // ignore invalid session payload
    }
  }, []);

  return (
    <>
      <p className="text-zinc-600 dark:text-zinc-400">{subtitle}</p>
      <ProductWizard key={initialProduct?.groupName ?? "default"} initialProduct={initialProduct} />
    </>
  );
}
