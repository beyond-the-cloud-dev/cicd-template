# CI/CD Templates for GitHub Actions

Centralne repozytorium z reużywalnymi workflow'ami dla projektów Salesforce i innych.

## 📋 Spis treści

- [Dostępne workflow'y](#dostępne-workflowy)
- [Jak używać](#jak-używać)
- [Konfiguracja secretów](#konfiguracja-secretów)
- [Przykłady użycia](#przykłady-użycia)
- [Wymagania](#wymagania)

## 🔄 Dostępne workflow'y

### Salesforce CI (pełny pipeline)
[.github/workflows/salesforce-ci.yml](.github/workflows/salesforce-ci.yml)

Kompletny pipeline CI dla projektów Salesforce:
- ✅ Tworzenie scratch org
- ✅ Deploy kodu
- ✅ Uruchamianie testów Apex
- ✅ Code coverage
- ✅ Opcjonalny upload do Codecov
- ✅ Automatyczne czyszczenie

### Salesforce Validation (bez testów)
[.github/workflows/salesforce-validation.yml](.github/workflows/salesforce-validation.yml)

Szybka walidacja dla Pull Requestów:
- ✅ Tworzenie scratch org
- ✅ Walidacja deploy'u
- ✅ Bez uruchamiania testów (szybsze)

### Salesforce PMD Code Scanner
[.github/workflows/salesforce-pmd-scanner.yml](.github/workflows/salesforce-pmd-scanner.yml)

Skanowanie jakości kodu Apex za pomocą PMD:
- ✅ Analiza statyczna kodu
- ✅ Wykrywanie potencjalnych błędów
- ✅ Sprawdzanie security best practices
- ✅ Sprawdzanie wydajności i stylu kodu
- ✅ Generowanie raportów

## 🚀 Jak używać

### Krok 1: Dodaj workflow do swojego projektu

Utwórz plik `.github/workflows/ci.yml` w swoim repozytorium:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  salesforce-ci:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@main
    with:
      node-version: '20'
      test-level: 'RunLocalTests'
      upload-to-codecov: true
      codecov-slug: ${{ github.repository }}
    secrets:
      SFDX_AUTH_URL_DEVHUB: ${{ secrets.SFDX_AUTH_URL_DEVHUB }}
      CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

### Krok 2: Skonfiguruj sekrety

Dodaj wymagane sekrety w swoim repozytorium (Settings → Secrets and variables → Actions):

**Wymagane:**
- `SFDX_AUTH_URL_DEVHUB` - URL uwierzytelnienia do Dev Hub

**Opcjonalne:**
- `CODECOV_TOKEN` - token do uploadu code coverage (jeśli używasz Codecov)

## 🔐 Konfiguracja secretów

### Dla repozytoriów publicznych
Możesz używać Organization Secrets, które będą automatycznie dostępne we wszystkich publicznych repozytoriach.

### Dla repozytoriów prywatnych (plan darmowy)
Niestety plan darmowy GitHub nie udostępnia Organization Secrets dla prywatnych repozytoriów. Musisz ręcznie dodać sekrety w każdym repozytorium:

1. Przejdź do Settings → Secrets and variables → Actions
2. Kliknij "New repository secret"
3. Dodaj sekrety z **dokładnie takimi samymi nazwami** jak w templatce

**Ważne:** Nazwy sekretów muszą się zgadzać! Pierwszeństwo ma secret z repozytorium, potem Organization secret.

### Jak uzyskać SFDX_AUTH_URL_DEVHUB

```bash
# Zaloguj się do swojego Dev Hub
sf org login web --alias DevHub --set-default-dev-hub

# Wyświetl auth URL
sf org display --verbose --target-org DevHub
```

Skopiuj wartość `Sfdx Auth Url` i dodaj ją jako secret.

## 📚 Przykłady użycia

Wszystkie przykłady znajdują się w katalogu [examples](./examples/):

### 1. Pełny CI z testami i Codecov
[examples/salesforce-full-ci.yml](./examples/salesforce-full-ci.yml)
```yaml
jobs:
  salesforce-ci:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@main
    with:
      upload-to-codecov: true
      codecov-slug: ${{ github.repository }}
    secrets:
      SFDX_AUTH_URL_DEVHUB: ${{ secrets.SFDX_AUTH_URL_DEVHUB }}
      CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Szybka walidacja PR (bez testów)
[examples/salesforce-pr-validation.yml](./examples/salesforce-pr-validation.yml)
```yaml
jobs:
  validate:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-validation.yml@main
    secrets:
      SFDX_AUTH_URL_DEVHUB: ${{ secrets.SFDX_AUTH_URL_DEVHUB }}
```

### 3. Połączona walidacja - szybka dla PR, pełna dla main
[examples/salesforce-combined-workflow.yml](./examples/salesforce-combined-workflow.yml)
```yaml
jobs:
  pr-validation:
    if: github.event_name == 'pull_request'
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-validation.yml@main

  main-ci:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@main
```

### 4. CI z PMD code quality scanning
[examples/salesforce-with-pmd.yml](./examples/salesforce-with-pmd.yml)
```yaml
jobs:
  code-quality:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-pmd-scanner.yml@main

  salesforce-ci:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@main
```

## ⚙️ Parametry konfiguracyjne

### Salesforce CI - Inputs

| Parametr | Typ | Domyślna wartość | Opis |
|----------|-----|------------------|------|
| `node-version` | string | `'20'` | Wersja Node.js |
| `scratch-org-duration` | number | `1` | Czas życia scratch org (dni) |
| `scratch-org-wait` | number | `30` | Timeout tworzenia scratch org (min) |
| `deploy-wait` | number | `30` | Timeout deploy'u (min) |
| `test-wait` | number | `30` | Timeout testów (min) |
| `test-level` | string | `'RunLocalTests'` | Poziom testów (RunLocalTests, RunAllTestsInOrg) |
| `scratch-def-file` | string | `'config/project-scratch-def.json'` | Ścieżka do definicji scratch org |
| `upload-to-codecov` | boolean | `false` | Czy uploadować coverage do Codecov |
| `codecov-slug` | string | `''` | Slug repozytorium dla Codecov (org/repo) |

### Salesforce CI - Secrets

| Secret | Wymagany | Opis |
|--------|----------|------|
| `SFDX_AUTH_URL_DEVHUB` | ✅ Tak | URL uwierzytelnienia do Dev Hub |
| `CODECOV_TOKEN` | ❌ Nie | Token Codecov (tylko jeśli upload-to-codecov=true) |

### Salesforce Validation - Inputs

| Parametr | Typ | Domyślna wartość | Opis |
|----------|-----|------------------|------|
| `node-version` | string | `'20'` | Wersja Node.js |
| `scratch-org-duration` | number | `1` | Czas życia scratch org (dni) |
| `scratch-org-wait` | number | `30` | Timeout tworzenia scratch org (min) |
| `deploy-wait` | number | `30` | Timeout deploy'u (min) |
| `scratch-def-file` | string | `'config/project-scratch-def.json'` | Ścieżka do definicji scratch org |

### PMD Scanner - Inputs

| Parametr | Typ | Domyślna wartość | Opis |
|----------|-----|------------------|------|
| `node-version` | string | `'20'` | Wersja Node.js |
| `pmd-version` | string | `'7.0.0'` | Wersja PMD |
| `ruleset` | string | `'ruleset.xml'` | Ścieżka do pliku z regułami PMD |
| `source-path` | string | `'force-app'` | Ścieżka do kodu źródłowego |
| `fail-on-violation` | boolean | `false` | Czy zakończyć z błędem przy naruszeniach |

## 🖥️ Wspierane systemy

- ✅ **Linux** (ubuntu-latest)
- ✅ **macOS** (można zmienić runner na `macos-latest`)
- ✅ **Windows** (można zmienić runner na `windows-latest`)

Aby użyć innego runnera, możesz nadpisać workflow lub stworzyć własną wersję.

## 📝 Wymagania

- **Node.js 20+** (domyślnie, konfigurowalny)
- **Salesforce CLI** (instalowany automatycznie)
- **Dev Hub** z pozwoleniem na tworzenie scratch org
- **Git** (do checkout kodu)

## 🔄 Aktualizacje

Workflow'y używają tagu `@main`, więc zawsze będą pobierać najnowszą wersję. Jeśli chcesz używać konkretnej wersji:

```yaml
uses: beyond-the-cloud-dev/cicd-template/.github/workflows/salesforce-ci.yml@v1.0.0
```

## 💡 Najlepsze praktyki

1. **Używaj `@main` dla testów**, `@v1.0.0` dla produkcji
2. **Dodaj sekrety na poziomie organizacji** dla repozytoriów publicznych
3. **Dla PR używaj validation** (szybsze, bez testów)
4. **Dla main używaj pełnego CI** (z testami i coverage)
5. **Zachowaj spójne nazwy sekretów** we wszystkich repozytoriach

## 🤝 Współpraca

Masz pomysł na nowy workflow? Stwórz Pull Request!

1. Fork tego repo
2. Utwórz branch dla swojego workflow'u
3. Dodaj workflow w `.github/workflows/`
4. Dodaj przykład w `examples/`
5. Zaktualizuj README.md
6. Utwórz Pull Request

## 📄 Licencja

MIT License - możesz używać tego repozytorium w swoich projektach.
