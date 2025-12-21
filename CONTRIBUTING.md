# Jak dodać nowy workflow?

Dziękujemy za zainteresowanie rozwojem tego projektu! Poniżej znajdziesz instrukcje, jak dodać nowy reużywalny workflow.

## Proces dodawania nowego workflow'u

### 1. Utwórz workflow w `.github/workflows/`

Nazwa pliku powinna być opisowa, np. `salesforce-deploy-prod.yml`

**Ważne elementy workflow'u:**
```yaml
name: Reusable <Nazwa Workflow>

on:
  workflow_call:
    inputs:
      # Parametry wejściowe z wartościami domyślnymi
      parameter-name:
        description: 'Opis parametru'
        required: false
        type: string
        default: 'wartość-domyślna'
    secrets:
      # Wymagane sekrety
      SECRET_NAME:
        description: 'Opis sekretu'
        required: true

jobs:
  job-name:
    runs-on: ubuntu-latest
    steps:
      # Twoje kroki
```

### 2. Dodaj przykład użycia w `examples/`

Utwórz plik z przykładem, np. `examples/salesforce-deploy-prod.yml`:

```yaml
# Example: <Krótki opis>
# Save this file as .github/workflows/<name>.yml in your project

name: <Nazwa>

on:
  push:
    branches: [ main ]

jobs:
  example-job:
    uses: beyond-the-cloud-dev/cicd-template/.github/workflows/<your-workflow>.yml@main
    with:
      parameter-name: 'value'
    secrets:
      SECRET_NAME: ${{ secrets.SECRET_NAME }}
```

### 3. Zaktualizuj README.md

Dodaj dokumentację nowego workflow'u:

1. **Sekcja "Dostępne workflow'y"** - dodaj krótki opis z bullet points
2. **Sekcja "Przykłady użycia"** - dodaj przykład z linkiem
3. **Sekcja "Parametry konfiguracyjne"** - dodaj tabelę z parametrami

### 4. Przetestuj workflow

Zanim utworzysz Pull Request, przetestuj workflow w swoim własnym repozytorium:

1. Fork tego repo
2. Dodaj swój workflow
3. Utwórz testowe repozytorium, które używa twojego forka
4. Uruchom workflow i upewnij się, że działa poprawnie

### 5. Utwórz Pull Request

1. Utwórz branch z opisową nazwą: `feature/add-prod-deployment-workflow`
2. Upewnij się, że dodałeś:
   - Workflow w `.github/workflows/`
   - Przykład w `examples/`
   - Dokumentację w `README.md`
3. Utwórz Pull Request z opisem:
   - Co dodaje ten workflow?
   - Jakie problemy rozwiązuje?
   - Jak go przetestowałeś?

## Dobre praktyki

### Nazewnictwo

- **Workflow files**: używaj kebab-case, np. `salesforce-deploy-prod.yml`
- **Job names**: używaj kebab-case, np. `deploy-to-production`
- **Input parameters**: używaj kebab-case, np. `scratch-org-duration`
- **Secret names**: używaj UPPER_SNAKE_CASE, np. `SFDX_AUTH_URL`

### Parametry wejściowe

- Zawsze dodawaj wartości domyślne dla opcjonalnych parametrów
- Używaj sensownych domyślnych wartości
- Dodawaj szczegółowe opisy

### Sekrety

- Oznacz sekrety jako `required: true` tylko jeśli są bezwzględnie wymagane
- Dodaj jasne opisy, jak uzyskać wartości sekretów
- Nigdy nie wpisuj wartości sekretów na stałe w workflow

### Emoji w krokach

Dla lepszej czytelności używaj emoji w nazwach kroków:
- 📥 Checkout kodu
- 🟢 Setup Node.js
- ⚡ Instalacja CLI
- 🔐 Autoryzacja
- 🚀 Deploy
- 🧪 Testy
- 📊 Upload artefaktów
- 🧹 Cleanup

### Artefakty i cache

- Używaj `actions/cache@v4` dla zależności
- Zapisuj wyniki testów jako artefakty z `retention-days: 30`
- Używaj `if: always()` dla cleanup kroków

### Obsługa błędów

- Dodawaj `if: always()` dla kroków cleanup
- Używaj `|| true` dla komend, które mogą się nie udać (np. delete scratch org)
- Dodaj jasne komunikaty o błędach

## Pytania?

Jeśli masz pytania, otwórz Issue w tym repozytorium!
