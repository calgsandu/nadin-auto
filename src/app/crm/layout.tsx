import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CrmLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* restores collapsed sidebar before paint, avoids flash */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem("nadin-crm-collapsed")==="1")document.documentElement.setAttribute("data-crm-collapsed","")}catch(e){}`,
        }}
      />
      {children}
    </>
  );
}
