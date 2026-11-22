import { SPRITE } from '@/lib/sprite';

/** يحقن أيقونات الـ sprite مرة واحدة في الصفحة */
export default function SpriteHost() {
  return <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: SPRITE }} />;
}
