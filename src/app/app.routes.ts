import type { Routes } from '@angular/router';
import { guestGuard, memberGuard, onboardingGuard } from '@core/auth/auth.guards';

/** Every page is lazy-loaded, so the first load only carries what sign-in needs. */
export const routes: Routes = [
  {
    path: 'sign-in',
    canActivate: [guestGuard],
    loadComponent: () => import('@features/auth/sign-in-page').then((m) => m.SignInPage),
  },
  {
    path: 'welcome',
    canActivate: [onboardingGuard],
    loadComponent: () => import('@features/onboarding/welcome-page').then((m) => m.WelcomePage),
  },
  {
    path: '',
    canActivate: [memberGuard],
    loadComponent: () =>
      import('@features/workspace/workspace-layout').then((m) => m.WorkspaceLayout),
    children: [
      {
        path: '',
        loadComponent: () => import('@features/workspace/home-page').then((m) => m.HomePage),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('@features/rooms/create-room-page').then((m) => m.CreateRoomPage),
      },
      {
        path: 'join',
        loadComponent: () => import('@features/rooms/join-room-page').then((m) => m.JoinRoomPage),
      },
      {
        path: 'join/:code',
        loadComponent: () => import('@features/rooms/join-room-page').then((m) => m.JoinRoomPage),
      },
      {
        path: 'dm/:userId',
        loadComponent: () =>
          import('@features/direct/open-direct-page').then((m) => m.OpenDirectPage),
      },
      {
        path: 'r/:roomId',
        loadComponent: () => import('@features/chat/chat-page').then((m) => m.ChatPage),
      },
      {
        path: 'emoji',
        loadComponent: () => import('@features/emoji/emoji-page').then((m) => m.EmojiPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('@features/profile/profile-page').then((m) => m.ProfilePage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('@features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
