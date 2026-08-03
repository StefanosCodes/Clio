import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

export const fixtureOrganizations = [
  { id: "fixture-acme", name: "Acme Studio" },
  { id: "fixture-orbit", name: "Orbit Works" },
] as const;

type FixtureOrganizationContextValue = {
  organizationId: string;
  organizationName: string;
  switching: boolean;
  scopeEpoch: number;
  registerAbort: (controller: AbortController) => () => void;
  switchOrganization: (organizationId: string) => Promise<void>;
};

const FixtureOrganizationContext = createContext<FixtureOrganizationContextValue | null>(null);

export function FixtureOrganizationProvider({ children }: PropsWithChildren) {
  const [organizationId, setOrganizationId] = useState<string>(fixtureOrganizations[0].id);
  const [switching, setSwitching] = useState(false);
  const [scopeEpoch, setScopeEpoch] = useState(0);
  const controllers = useRef(new Set<AbortController>());
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const registerAbort = useCallback((controller: AbortController) => {
    controllers.current.add(controller);
    return () => controllers.current.delete(controller);
  }, []);

  const switchOrganization = useCallback(
    async (nextOrganizationId: string) => {
      if (nextOrganizationId === organizationId) return;
      setSwitching(true);
      controllers.current.forEach((controller) => controller.abort("organization-switch"));
      controllers.current.clear();
      await queryClient.cancelQueries({
        queryKey: ["organization", organizationId],
      });
      queryClient.removeQueries({ queryKey: ["organization", organizationId] });
      setScopeEpoch((value) => value + 1);
      setOrganizationId(nextOrganizationId);
      navigate(`/organizations/${nextOrganizationId}`, { replace: true });
      setSwitching(false);
    },
    [navigate, organizationId, queryClient],
  );

  const value = useMemo<FixtureOrganizationContextValue>(
    () => ({
      organizationId,
      organizationName:
        fixtureOrganizations.find((organization) => organization.id === organizationId)
          ?.name ?? "Fixture organization",
      switching,
      scopeEpoch,
      registerAbort,
      switchOrganization,
    }),
    [organizationId, registerAbort, scopeEpoch, switchOrganization, switching],
  );

  return (
    <FixtureOrganizationContext.Provider value={value}>
      {switching ? (
        <div className="tenant-curtain" role="status">
          Clearing organization state…
        </div>
      ) : (
        children
      )}
    </FixtureOrganizationContext.Provider>
  );
}

export function useFixtureOrganization() {
  const context = useContext(FixtureOrganizationContext);
  if (!context) throw new Error("FixtureOrganizationProvider is required");
  return context;
}
