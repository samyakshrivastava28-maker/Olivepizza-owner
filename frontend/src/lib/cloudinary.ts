import { fetchApi } from './api';

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  public_id: string;
  format: string;
  bytes: number;
  type?: string;
}

export const uploadMediaToCloudinary = async (
  file: File,
  folderOrProgress?: string | ((percent: number) => void),
  onProgress?: (percent: number) => void
): Promise<UploadResult> => {
  const progressCallback = typeof folderOrProgress === 'function' ? folderOrProgress : onProgress;
  const folder = typeof folderOrProgress === 'string' ? folderOrProgress : 'olive-pizza';

  return new Promise(async (resolve, reject) => {
    try {
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';

      if (!cloudName || !uploadPreset) {
        // Direct to backend proxy upload if client-side env vars are not set
        return uploadViaBackend(file, folder).then(resolve).catch(reject);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      if (folder) formData.append('folder', folder);

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);

      if (xhr.upload && progressCallback) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressCallback(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            const secureUrl = res.secure_url || res.url;
            const publicId = res.public_id || '';
            resolve({
              url: secureUrl,
              secureUrl: secureUrl,
              publicId: publicId,
              public_id: publicId,
              format: res.format || 'jpg',
              bytes: res.bytes || file.size,
              type: res.resource_type || 'image',
            });
          } catch {
            uploadViaBackend(file, folder).then(resolve).catch(reject);
          }
        } else {
          // If unsigned client upload failed, attempt server upload proxy
          uploadViaBackend(file, folder).then(resolve).catch(reject);
        }
      };

      xhr.onerror = () => {
        uploadViaBackend(file, folder).then(resolve).catch(reject);
      };

      xhr.send(formData);
    } catch {
      uploadViaBackend(file, folder).then(resolve).catch(reject);
    }
  });
};

export const deleteMediaFromCloudinary = async (publicId: string, _tokenOrType?: string): Promise<boolean> => {
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

const uploadViaBackend = async (file: File, folder?: string): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('image', file);
  if (folder) formData.append('folder', folder);

  const res = await fetchApi('/api/media/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Cloudinary upload failed via server proxy');
  }

  const data = await res.json();
  const secureUrl = data.secure_url || data.url;
  const publicId = data.public_id || data.publicId || '';
  return {
    url: secureUrl,
    secureUrl: secureUrl,
    publicId: publicId,
    public_id: publicId,
    format: data.format || 'jpg',
    bytes: data.bytes || file.size,
    type: data.resource_type || data.type || 'image',
  };
};
