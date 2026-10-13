import { useCurrentUser } from '@/features/auth/hooks/useSession';
import { ja } from '@/i18n/ja';
import { MenuCard } from './MenuCard';
import { adminMenu, mainMenu, type MenuItem, visibleItems } from './menus';

function MenuGrid({ items }: { items: MenuItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.key}>
          <MenuCard item={item} />
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const { permissions } = useCurrentUser();
  const main = visibleItems(mainMenu, permissions);
  const admin = visibleItems(adminMenu, permissions);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="home-title">
        <h1 id="home-title" className="mb-6 text-2xl font-bold">
          {ja.home.title}
        </h1>
        <MenuGrid items={main} />
      </section>
      {admin.length > 0 && (
        <section aria-labelledby="admin-title">
          <h2 id="admin-title" className="mb-4 text-lg font-bold">
            {ja.admin.title}
          </h2>
          <MenuGrid items={admin} />
        </section>
      )}
    </div>
  );
}
