/**
 * Download a file through a short-lived signed URL (file storage). The server sets
 * Content-Disposition: attachment, so the browser saves the file and stays on the page.
 */
export const openSignedLink = (url) => {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
};
