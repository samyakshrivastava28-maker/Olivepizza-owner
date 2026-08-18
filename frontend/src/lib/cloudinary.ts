import { fetchApi } from './api';

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
}

export const uploadMediaToCloudinary = async (
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> => {
  return new Promise(async (resolve, reject) => {
    try {
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';

      if (!cloudName || !uploadPreset) {
        // Direct to backend proxy upload if client-side env vars are not set
        return uploadViaBackend(file).then(resolve).catch(reject);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve({
              url: res.secure_url || res.url,
              publicId: res.public_id,
              format: res.format,
              bytes: res.bytes,
            });
          } catch {
            uploadViaBackend(file).then(resolve).catch(reject);
          }
        } else {
          // If unsigned client upload failed, attempt server upload proxy
          uploadViaBackend(file).then(resolve).catch(reject);
        }
      };

      xhr.onerror = () => {
        uploadViaBackend(file).then(resolve).catch(reject);
      };

      xhr.send(formData);
    } catch {
      uploadViaBackend(file).then(resolve).catch(reject);
    }
  });
};

export const deleteMediaFromCloudinary = async (publicId: string): Promise<boolean> => {
  try {
    const res = await fetchApi(`/api/media/${encodeURIComponent(publicId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    console.warn('Delete media error:', e);
    return false;
  }
};

const uploadViaBackend = async (file: File): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetchApi('/api/media/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Cloudinary upload failed via server proxy');
  }

  const data = await res.json();
  return {
    url: data.url || data.secure_url,
    publicId: data.public_id || '',
    format: data.format || 'jpg',
    bytes: data.bytes || file.size,
  };
};
