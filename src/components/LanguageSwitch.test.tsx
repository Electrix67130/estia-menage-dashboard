import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "@/contexts/I18nContext";
import LanguageSwitch from "./LanguageSwitch";

function Probe() {
  const { t } = useI18n();
  return <p data-testid="probe">{t("common.cancel")}</p>;
}

describe("Sélecteur de langue (écrans d'authentification)", () => {
  it("propose les 8 langues et démarre en français", () => {
    render(
      <I18nProvider>
        <LanguageSwitch />
      </I18nProvider>,
    );
    const select = screen.getByRole("combobox", { name: "Langue" });
    expect(select).toHaveValue("fr");
    expect(screen.getAllByRole("option")).toHaveLength(8);
  });

  it("changer de langue traduit l'écran immédiatement et mémorise le choix", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <LanguageSwitch />
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("Annuler");

    await user.selectOptions(screen.getByRole("combobox"), "en");

    expect(screen.getByTestId("probe")).toHaveTextContent("Cancel");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en");
    expect(window.localStorage.getItem("estia-menage_locale")).toBe("en");
  });
});
