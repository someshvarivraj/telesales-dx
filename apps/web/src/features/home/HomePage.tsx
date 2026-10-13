import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { ja } from '@/i18n/ja';
import { MenuCard } from './MenuCard';
import { menusByRole } from './menus';

export function HomePage() {
  const user = useCurrentUser();
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title" className="mb-6 text-2xl font-bold">
        {ja.home.title}
      </h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {menusByRole[user.role].map((item) => (
          <li key={item.key}>
            <MenuCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
