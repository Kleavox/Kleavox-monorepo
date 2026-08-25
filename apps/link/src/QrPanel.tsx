import { createPortal } from "react-dom";
import { useId } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useDialog } from "@kleavox/ui";

interface QrPanelLink {
  slug: string;
  shortUrl: string;
}

export default function QrPanel({
  link,
  onClose,
}: {
  link: QrPanelLink;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useDialog<HTMLElement>(onClose);
  const download = () => {
    const svg = document.querySelector<SVGElement>("#link-qr-code");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${link.slug}.svg`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return createPortal(
    <div className="link-modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="link-stats link-qr"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header>
          <div>
            <p className="link-kicker">QR / {link.slug}</p>
            <h2 id={titleId}>Scan route</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div>
          <QRCodeSVG
            id="link-qr-code"
            value={link.shortUrl}
            size={256}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
          />
        </div>
        <button className="link-primary" onClick={download}>
          Download SVG
        </button>
      </section>
    </div>,
    document.body,
  );
}
