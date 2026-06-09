import { Router, Request, Response } from 'express';
import { LANGUAGE_CONFIG, SUPPORTED_LANGUAGES } from '@exebox/shared';

const router = Router();

const LANGUAGE_VERSIONS: Record<string, string> = {
  python: '3.12',
  javascript: '20',
  typescript: '5.4',
  go: '1.22',
  java: '21',
  cpp: '17',
  rust: '1.77',
};

router.get('/', (_req: Request, res: Response) => {
  const languages = SUPPORTED_LANGUAGES.map((lang) => ({
    name: lang,
    version: LANGUAGE_VERSIONS[lang] || 'latest',
    timeout: LANGUAGE_CONFIG[lang].timeout,
    memoryLimit: LANGUAGE_CONFIG[lang].memoryLimit,
    cpuLimit: LANGUAGE_CONFIG[lang].cpuLimit,
  }));

  return res.json({
    success: true,
    data: languages,
  });
});

export default router;
