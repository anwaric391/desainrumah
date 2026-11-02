import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface ExportFileOptions {
  fileName: string;
  mimeType: string;
  data: string;
  encoding?: 'utf8' | 'base64';
}

export const sanitizeFileName = (fileName: string): string =>
  fileName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');

export const exportFile = async ({
  fileName,
  mimeType,
  data,
  encoding = 'utf8',
}: ExportFileOptions): Promise<void> => {
  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName || safeFileName === '.' || safeFileName === '..') {
    throw new Error('Nama file ekspor tidak valid.');
  }

  if (Capacitor.isNativePlatform()) {
    const path = `exports/${safeFileName}`;
    await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Cache,
      recursive: true,
      ...(encoding === 'utf8' ? { encoding: Encoding.UTF8 } : {}),
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({
      title: safeFileName,
      dialogTitle: 'Simpan atau bagikan file',
      files: [uri],
    });
    return;
  }

  const url = encoding === 'base64'
    ? `data:${mimeType};base64,${data}`
    : URL.createObjectURL(new Blob([data], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName;
  anchor.click();
  if (encoding !== 'base64') {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
