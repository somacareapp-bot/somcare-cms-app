// Fetches an image URL (e.g. the uploaded facility logo, served from
// /uploads/facility/...) and converts it to a base64 data URI so it can be
// passed to jsPDF's doc.addImage(), which needs base64/DataURL input rather
// than a plain URL. Returns undefined on any failure so callers can fall
// back to the vector logo mark instead of breaking PDF generation.
export async function loadImageAsBase64(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
