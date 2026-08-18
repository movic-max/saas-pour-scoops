import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, verifySessionToken } from '@/lib/admin-session';
import { type UnitId } from '@/lib/data';
import { accessRequirementsForPath, hasAccessToRequirements, unitFromPath } from '@/lib/route-access';

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/connexion';
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function redirectToSelection(request: NextRequest, reason = 'denied', unit?: string) {
  const url = request.nextUrl.clone();
  url.pathname = '/selection-unite';
  url.searchParams.set('denied', '1');
  url.searchParams.set('reason', reason);
  if (unit) url.searchParams.set('unit', unit);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = request.cookies.get('agroflux_session')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  const expectedAdmin = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase();

  if (pathname.startsWith('/dashboard-admin')) {
    const adminToken = request.cookies.get('agroflux_admin_token')?.value;
    if (session !== 'active' || !(await verifyAdminToken(adminToken, secret, expectedAdmin))) return redirectToLogin(request);
    return NextResponse.next();
  }

  if (session !== 'active') return redirectToLogin(request);
  const claims = await verifySessionToken(request.cookies.get('agroflux_user_token')?.value, secret);
  if (!claims) return redirectToLogin(request);
  if (claims.admin) return NextResponse.next();

  if (pathname === '/dashboard/global') {
    return claims.role === 'PDG' || claims.role === 'DG' || claims.role === 'Administratrice'
      ? NextResponse.next()
      : redirectToSelection(request, 'role');
  }
  if (pathname === '/dashboard') {
    const activeUnit = request.cookies.get('agroflux_active_unit')?.value;
    if (activeUnit && activeUnit !== 'global' && claims.allowedUnits.includes(activeUnit)) {
      const dashboardRequirements = accessRequirementsForPath(`/dashboard/${activeUnit}`, activeUnit as UnitId);
      return hasAccessToRequirements(claims.access, dashboardRequirements)
        ? NextResponse.next()
        : redirectToSelection(request, 'access', activeUnit);
    }
    return claims.role === 'PDG' || claims.role === 'DG' || claims.role === 'Administratrice'
      ? NextResponse.next()
      : redirectToSelection(request, 'role');
  }
  if (pathname.startsWith('/parametres/communication')) return redirectToSelection(request, 'admin');

  const requestedUnit = unitFromPath(pathname);
  if (requestedUnit && !claims.allowedUnits.includes(requestedUnit)) return redirectToSelection(request, 'unit', requestedUnit);

  const requirements = accessRequirementsForPath(pathname, requestedUnit);
  if (!hasAccessToRequirements(claims.access, requirements)) return redirectToSelection(request, 'access', requestedUnit);

  return NextResponse.next();
}

export const config = { matcher: ['/selection-unite/:path*', '/dashboard/:path*', '/dashboard-admin/:path*', '/poulets/:path*', '/chevrerie/:path*', '/rh/:path*', '/provenderie/:path*', '/produits-bio/:path*', '/pressoir/:path*', '/stocks/:path*', '/mouvements/:path*', '/factures/:path*', '/clients/:path*', '/fournisseurs/:path*', '/chat/:path*', '/achats/:path*', '/depenses/:path*', '/caisse/:path*', '/comptabilite/:path*', '/rapports/:path*', '/parametres/:path*'] };
