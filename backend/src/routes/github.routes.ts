import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();
const DEFAULT_REPO = 'samyakshrivastava28-maker/Olive-Pizza';

function getTargetRepo(appParam?: any): string {
  const map: Record<string, string> = {
    customer: 'samyakshrivastava28-maker/Olive-Pizza',
    owner: 'samyakshrivastava28-maker/Olivepizza-owner',
    delivery: 'samyakshrivastava28-maker/olive-pizza-delivery',
    restaurant: 'samyakshrivastava28-maker/olive-pizza-restaurant',
    pos: 'samyakshrivastava28-maker/olive-pizza-pos',
    franchise: 'samyakshrivastava28-maker/olive-pizza-franchise'
  };
  const key = String(appParam || '').trim().toLowerCase();
  return map[key] || DEFAULT_REPO;
}

// Trigger a new Android APK Build
router.post('/build-apk', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'GITHUB_TOKEN is not configured on the server.' });
    }

    const targetRepo = getTargetRepo(req.body.app || req.query.app);

    const response = await fetch(`https://api.github.com/repos/${targetRepo}/actions/workflows/build-android.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
      }),
    });

    if (response.ok) {
      res.json({ success: true, message: `Build triggered successfully for ${targetRepo}`, repo: targetRepo });
    } else {
      const errorText = await response.text();
      res.status(response.status).json({ error: 'Failed to trigger build', details: errorText, repo: targetRepo });
    }
  } catch (error: any) {
    console.error('Error triggering APK build:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get the latest Android APK Build status
router.get('/build-status', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const targetRepo = getTargetRepo(req.query.app);
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OlivePizza-Backend'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${targetRepo}/actions/workflows/build-android.yml/runs?per_page=1`, {
      headers
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch build status', repo: targetRepo });
    }

    const data = await response.json();
    const latestRun = data.workflow_runs?.[0];

    if (!latestRun) {
      return res.json({ status: 'No builds found', run: null, repo: targetRepo });
    }

    res.json({
      repo: targetRepo,
      status: latestRun.status,
      conclusion: latestRun.conclusion,
      run_number: latestRun.run_number,
      created_at: latestRun.created_at,
      updated_at: latestRun.updated_at,
      html_url: latestRun.html_url,
      head_sha: latestRun.head_sha,
      head_commit_message: latestRun.head_commit?.message
    });
  } catch (error: any) {
    console.error('Error fetching build status:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get the latest Release (Publicly readable so app download sections work)
router.get('/latest-release', async (req, res) => {
  try {
    const targetRepo = getTargetRepo(req.query.app);
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OlivePizza-Backend'
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // Try 'latest' tag release
    let data: any = null;
    let response = await fetch(`https://api.github.com/repos/${targetRepo}/releases/latest`, { headers });
    if (response.ok) {
      data = await response.json();
    } else {
      // Fallback to tags/latest or list
      const listRes = await fetch(`https://api.github.com/repos/${targetRepo}/releases?per_page=1`, { headers });
      if (listRes.ok) {
        const list = await listRes.json();
        if (Array.isArray(list) && list.length > 0) {
          data = list[0];
        }
      }
    }

    if (!data) {
      return res.status(404).json({ error: 'No release found for repository', repo: targetRepo });
    }

    const apkAsset = data.assets?.find((asset: any) => asset.name?.endsWith('.apk'));
    const exeAsset = data.assets?.find((asset: any) => asset.name?.endsWith('.exe'));
    const dmgAsset = data.assets?.find((asset: any) => asset.name?.endsWith('.dmg'));
    const ipaAsset = data.assets?.find((asset: any) => asset.name?.endsWith('.ipa'));

    res.json({
      repo: targetRepo,
      release: {
        name: data.name,
        tag_name: data.tag_name,
        body: data.body,
        published_at: data.published_at,
      },
      apk: apkAsset ? {
        name: apkAsset.name,
        size: apkAsset.size,
        download_url: apkAsset.browser_download_url,
        github_download_url: apkAsset.browser_download_url,
        download_count: apkAsset.download_count
      } : null,
      exe: exeAsset ? {
        name: exeAsset.name,
        size: exeAsset.size,
        download_url: exeAsset.browser_download_url
      } : null,
      dmg: dmgAsset ? {
        name: dmgAsset.name,
        size: dmgAsset.size,
        download_url: dmgAsset.browser_download_url
      } : null,
      ipa: ipaAsset ? {
        name: ipaAsset.name,
        size: ipaAsset.size,
        download_url: ipaAsset.browser_download_url
      } : null
    });
  } catch (error: any) {
    console.error('Error fetching latest release:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Direct APK download redirect
router.get('/download-apk', async (req, res) => {
  try {
    const targetRepo = getTargetRepo(req.query.app);
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OlivePizza-Backend'
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    let apkAsset: any = null;

    try {
      const latestRes = await fetch(`https://api.github.com/repos/${targetRepo}/releases/latest`, { headers });
      if (latestRes.ok) {
        const data = await latestRes.json();
        apkAsset = data.assets?.find((asset: any) => asset.name?.endsWith('.apk'));
      }
    } catch (e) {
      console.warn('[GitHub Router] Latest release fetch error:', e);
    }

    if (!apkAsset) {
      try {
        const allRes = await fetch(`https://api.github.com/repos/${targetRepo}/releases?per_page=5`, { headers });
        if (allRes.ok) {
          const releases = await allRes.json();
          if (Array.isArray(releases)) {
            for (const r of releases) {
              const asset = r.assets?.find((a: any) => a.name?.endsWith('.apk'));
              if (asset) {
                apkAsset = asset;
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[GitHub Router] All releases fetch failed:', e);
      }
    }

    if (apkAsset && apkAsset.browser_download_url) {
      return res.redirect(302, apkAsset.browser_download_url);
    }

    return res.redirect(`https://github.com/${targetRepo}/releases`);
  } catch (error: any) {
    console.error('Error redirecting to APK:', error);
    return res.redirect(`https://github.com/${DEFAULT_REPO}/releases`);
  }
});

export default router;
