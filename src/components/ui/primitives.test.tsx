import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Avatar from "./Avatar";
import Badge from "./Badge";
import Button from "./Button";

describe("Avatar", () => {
  it("affiche les initiales sans image", () => {
    render(<Avatar firstName="Ana" lastName="Lopez" />);
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("préfère la miniature à l'original quand elle existe", () => {
    render(<Avatar src="/files/full.jpg" thumbnailSrc="/files/thumb.jpg" />);
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/files/thumb.jpg");
  });

  it("retombe sur l'original sans miniature", () => {
    render(<Avatar src="/files/full.jpg" thumbnailSrc={null} />);
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/files/full.jpg");
  });
});

describe("Button", () => {
  it("est désactivé pendant le chargement et affiche un spinner", () => {
    const { container } = render(<Button loading>Enregistrer</Button>);
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("applique la variante danger", () => {
    render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-rose-600");
  });
});

describe("Badge", () => {
  it("variante par défaut neutre, variante success teal", () => {
    render(
      <>
        <Badge>neutre</Badge>
        <Badge variant="success">ok</Badge>
      </>,
    );
    expect(screen.getByText("neutre")).toHaveClass("bg-zinc-100");
    expect(screen.getByText("ok")).toHaveClass("bg-teal-100");
  });
});
