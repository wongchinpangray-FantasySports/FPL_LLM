/** Extra tags WeChat / QQ read in addition to Open Graph. Hoisted into <head>. */
export function ShareCrawlerTags({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image: string;
}) {
  return (
    <>
      <link rel="image_src" href={image} />
      <meta itemProp="name" content={title} />
      <meta itemProp="description" content={description} />
      <meta itemProp="image" content={image} />
    </>
  );
}
