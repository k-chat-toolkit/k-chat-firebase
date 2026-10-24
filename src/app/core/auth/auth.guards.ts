import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { ProfileService } from '@core/data/profile.service';
import { AuthService } from './auth.service';

/** Where to go after signing in: the page that sent you to sign in, if it was in the app. */
export function safeRedirect(target: unknown): string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/';
}

// Guards inject everything before their first `await`: inject() only works synchronously.

/** Signed in, with a profile. Otherwise: sign in first, or pick a display name first. */
export const memberGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const profiles = inject(ProfileService);
  const user = await auth.ready();
  if (!user) {
    return router.createUrlTree(['/sign-in'], { queryParams: { redirect: state.url } });
  }
  if (!(await profiles.loadMine(user.uid))) {
    return router.createUrlTree(['/welcome'], { queryParams: { redirect: state.url } });
  }
  return true;
};

/** Signed in, still without a profile: the welcome page. */
export const onboardingGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const profiles = inject(ProfileService);
  const user = await auth.ready();
  if (!user) return router.createUrlTree(['/sign-in']);
  const profile = await profiles.loadMine(user.uid);
  return profile ? router.parseUrl(safeRedirect(route.queryParamMap.get('redirect'))) : true;
};

/** Signed out: the sign-in page. */
export const guestGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const user = await auth.ready();
  return user ? router.parseUrl(safeRedirect(route.queryParamMap.get('redirect'))) : true;
};
