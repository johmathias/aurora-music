// Maps a route (what the navigation store knows) to the screen that shows it.

import type { Tab, Route } from './store/ui';
import { Browse } from './screens/Browse';
import { AlbumScreen, ArtistScreen, GenreScreen, PlaylistScreen, SmartScreen } from './screens/Details';
import { Library } from './screens/Library';
import { AlbumsScreen, ArtistsScreen, GenresScreen, PlaylistsScreen, SongsScreen } from './screens/Lists';
import { ListenNow } from './screens/ListenNow';
import { Radio } from './screens/Radio';
import { Search } from './screens/Search';

export const TAB_LABEL: Record<Tab, string> = {
  listen: 'Listen Now',
  browse: 'Browse',
  radio: 'Radio',
  library: 'Library',
  search: 'Search',
};

export function renderRoute(tab: Tab, route: Route) {
  switch (route.kind) {
    case 'root':
      return tab === 'listen' ? <ListenNow /> : tab === 'browse' ? <Browse /> : tab === 'radio' ? <Radio /> : tab === 'library' ? <Library /> : <Search />;
    case 'album': return <AlbumScreen albumKey={route.key} />;
    case 'artist': return <ArtistScreen artistKeyValue={route.key} />;
    case 'playlist': return <PlaylistScreen id={route.id} />;
    case 'genre': return <GenreScreen name={route.name} />;
    case 'songs': return <SongsScreen source={route.source} />;
    case 'smart': return <SmartScreen id={route.id} />;
    case 'albums': return <AlbumsScreen />;
    case 'artists': return <ArtistsScreen />;
    case 'genres': return <GenresScreen />;
    case 'playlists': return <PlaylistsScreen />;
  }
}
