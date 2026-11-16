import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { Empty, Button } from '../components/ui';

export default function NotFound() {
  const { t } = useI18n();
  return <Empty icon="🧭" title={t('notFound.title')} text={t('notFound.text')} action={<Link to="/"><Button variant="gold">{t('nav.explore')}</Button></Link>} />;
}
