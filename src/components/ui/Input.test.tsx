import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Input from "./Input";
import { stripLeadingZeros } from "@/lib/number-input";

function NombreDeLits({ initial = "0" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <Input id="lits" label="Lits simples" type="number" value={value} onChange={(e) => setValue(e.target.value)} />;
}

describe("Input numérique", () => {
  it("le 0 par défaut est remplacé quand on tape un nombre", async () => {
    render(<NombreDeLits />);
    const champ = screen.getByLabelText("Lits simples");
    await userEvent.click(champ);
    await userEvent.keyboard("5");
    expect(champ).toHaveValue(5);
    expect((champ as HTMLInputElement).value).toBe("5");
  });

  it("un zéro de tête restant saute (« 05 » → « 5 »)", () => {
    expect(stripLeadingZeros("05")).toBe("5");
    expect(stripLeadingZeros("0.5")).toBe("0.5");
    expect(stripLeadingZeros("0")).toBe("0");
  });

  it("un champ texte n’est pas touché (un code postal garde son zéro)", async () => {
    function CodePostal() {
      const [value, setValue] = useState("");
      return <Input id="cp" label="Code postal" value={value} onChange={(e) => setValue(e.target.value)} />;
    }
    render(<CodePostal />);
    await userEvent.type(screen.getByLabelText("Code postal"), "01000");
    expect(screen.getByLabelText("Code postal")).toHaveValue("01000");
  });
});
