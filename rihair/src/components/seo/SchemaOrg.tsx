export function SchemaOrg() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://rihaircollectables.com";

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${appUrl}/#organization`,
        name: "RI Hair Collectables",
        url: appUrl,
        logo: {
          "@type": "ImageObject",
          url: `${appUrl}/icons/logo.png`,
        },
        sameAs: [
          "https://instagram.com/rihaircollectables",
          "https://youtube.com/@rihaircollectables",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          availableLanguage: "English",
        },
        areaServed: ["NG", "GH", "GB", "US", "CA"],
      },
      {
        "@type": "WebSite",
        "@id": `${appUrl}/#website`,
        url: appUrl,
        name: "RI Hair Collectables",
        publisher: { "@id": `${appUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${appUrl}/shop?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
