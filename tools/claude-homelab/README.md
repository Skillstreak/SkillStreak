# Claude Code on the home-lab cluster

A Claude Code workstation pod on **skillstreak01** (20 cores / 31 GB),
namespace `claude-skillstreak`, set up 2026-11-23 so long sessions stop
competing for ubuntu01's CPU and memory.

- `/home/chrisp` is a 60 Gi `local-path-retain` PVC: the repo working
  tree (incl. gitignored `docs/internal/`), `~/.claude` memory, agents and
  skills. Same paths as ubuntu01, so Claude's per-project memory carries over.
- Kubeconfig contexts `skillstreak`, `skillstreak-gpu`, `skillstreak-homelab`
  come from the Secret `kubeconfig` (mounted at `/etc/claude-kube/config`),
  created from local files — never committed. The `issassist` contexts are
  deliberately not included.
- System packages are reinstalled by `bootstrap.sh` on every pod start;
  everything under `/home/chrisp` persists.

## Attach

```
kubectl --kubeconfig ~/.kube/skillstreak-homelab.yaml --context skillstreak-homelab \
  -n claude-skillstreak exec -it deploy/claude -- su - chrisp -c 'tmux new -A -s claude'
```

Detach with `Ctrl-b d`; the session keeps running in the pod.

## One-time logins (the owner does these, inside the pod)

```
gh auth login            # GitHub, HTTPS; git uses gh as credential helper
cd ~/Github/Other/SkillStreak/mobile && npx eas-cli login
kubectl --context=skillstreak get ns   # prints a device-code URL for prod OIDC
claude                   # then /login
```

Prod and GPU use OIDC device-code login (`kubelogin`, installed in
`~/.local/bin`); the token cache stays in the pod's home.

## Recreate the kubeconfig Secret

Build a flattened kubeconfig with only the three contexts above and
`kubectl -n claude-skillstreak create secret generic kubeconfig --from-file=config=<file>`
(`--dry-run=client -o yaml | kubectl apply -f -` to replace). Delete the
temporary file afterwards.
