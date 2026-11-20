import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Coffee,
  Edit3,
  Moon,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import {
  AppDataSchema,
  DayOfWeekKey,
  MealItem,
  MealType,
  NavigationSection,
} from '../types/finance';
import {
  DAYS_OF_WEEK,
  StorageService,
} from '../utils/storage';

interface WeeklyMenuPlannerViewProps {
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  showToast: (text: string, kind?: 'success' | 'error' | 'info') => void;
  onNavigateToSection?: (section: NavigationSection) => void;
}

const MEAL_TYPE_STYLES: Record<
  MealType,
  {
    cardClass: string;
    badgeClass: string;
    chipClass: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  Desayuno: {
    cardClass:
      'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50',
    badgeClass:
      'bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30',
    chipClass:
      'bg-amber-500/15 text-amber-900 dark:text-amber-100 border border-amber-500/25',
    label: 'Desayuno',
    Icon: Coffee,
  },
  Almuerzo: {
    cardClass:
      'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50',
    badgeClass:
      'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30',
    chipClass:
      'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border border-emerald-500/25',
    label: 'Almuerzo',
    Icon: Sun,
  },
  Cena: {
    cardClass:
      'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/50',
    badgeClass:
      'bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border border-indigo-500/30',
    chipClass:
      'bg-indigo-500/15 text-indigo-900 dark:text-indigo-100 border border-indigo-500/25',
    label: 'Cena',
    Icon: Moon,
  },
};

export const WeeklyMenuPlannerView: React.FC<WeeklyMenuPlannerViewProps> = ({
  appData,
  setAppData,
  showToast,
  onNavigateToSection,
}) => {
  const weeklyMenu = useMemo(
    () => StorageService.getWeeklyMenu(appData),
    [appData]
  );

  const openMarketLists = useMemo(
    () => (appData.marketLists || []).filter((l) => l.estado === 'abierta'),
    [appData.marketLists]
  );

  const [selectedTargetListId, setSelectedTargetListId] = useState<string>(
    () => openMarketLists[0]?.id || ''
  );

  // Acordeón vertical en móvil (por defecto Lunes expandido)
  const [expandedMobileDay, setExpandedMobileDay] = useState<DayOfWeekKey | null>(
    'Lunes'
  );

  // Estado del Modal para Agregar / Editar Comida
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [modalDay, setModalDay] = useState<DayOfWeekKey>('Lunes');
  const [editingMealId, setEditingMealId] = useState<string | undefined>(
    undefined
  );
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState<MealType>('Almuerzo');
  const [ingredientsList, setIngredientsList] = useState<string[]>([]);
  const [ingredientDraft, setIngredientDraft] = useState('');

  // Estadísticas rápidas de la semana
  const weekStats = useMemo(() => {
    let totalMeals = 0;
    let totalIngredients = 0;
    const uniqueIngredients = new Set<string>();

    for (const day of DAYS_OF_WEEK) {
      const meals = weeklyMenu.dias[day] || [];
      totalMeals += meals.length;
      for (const m of meals) {
        for (const ing of m.ingredientes || []) {
          const clean = ing.trim();
          if (clean) {
            totalIngredients += 1;
            uniqueIngredients.add(clean.toLowerCase());
          }
        }
      }
    }

    return {
      totalMeals,
      totalIngredients,
      uniqueIngredientsCount: uniqueIngredients.size,
    };
  }, [weeklyMenu]);

  const openAddMealModal = (
    day: DayOfWeekKey,
    defaultType: MealType = 'Almuerzo'
  ) => {
    setModalDay(day);
    setEditingMealId(undefined);
    setMealName('');
    setMealType(defaultType);
    setIngredientsList([]);
    setIngredientDraft('');
    setMealModalOpen(true);
  };

  const openEditMealModal = (day: DayOfWeekKey, meal: MealItem) => {
    setModalDay(day);
    setEditingMealId(meal.id);
    setMealName(meal.nombre);
    setMealType(meal.tipo);
    setIngredientsList([...(meal.ingredientes || [])]);
    setIngredientDraft('');
    setMealModalOpen(true);
  };

  const handleAddDraftIngredients = () => {
    if (!ingredientDraft.trim()) return;
    const parts = ingredientDraft
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    setIngredientsList((prev) => {
      const existingLower = new Set(prev.map((p) => p.toLowerCase()));
      const additions = parts.filter(
        (p) => !existingLower.has(p.toLowerCase())
      );
      return [...prev, ...additions];
    });
    setIngredientDraft('');
  };

  const handleRemoveIngredientChip = (index: number) => {
    setIngredientsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveMealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Si quedó texto escrito en el campo de ingrediente sin presionar '+', incluirlo también
      let finalIngredients = [...ingredientsList];
      if (ingredientDraft.trim()) {
        const extra = ingredientDraft
          .split(/[,;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const existingLower = new Set(
          finalIngredients.map((p) => p.toLowerCase())
        );
        for (const item of extra) {
          if (!existingLower.has(item.toLowerCase())) {
            finalIngredients.push(item);
            existingLower.add(item.toLowerCase());
          }
        }
      }

      const { updatedData, meal } = StorageService.saveMealToDay(
        modalDay,
        {
          id: editingMealId,
          nombre: mealName,
          tipo: mealType,
          ingredientes: finalIngredients,
        },
        appData
      );

      setAppData(updatedData);
      setMealModalOpen(false);
      showToast(
        editingMealId
          ? `Comida «${meal.nombre}» actualizada en ${modalDay}.`
          : `Comida «${meal.nombre}» agregada al ${modalDay}.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'No se pudo guardar la comida.',
        'error'
      );
    }
  };

  const handleDeleteMeal = (day: DayOfWeekKey, meal: MealItem) => {
    const updatedData = StorageService.deleteMealFromDay(
      day,
      meal.id,
      appData
    );
    setAppData(updatedData);
    showToast(`Se eliminó «${meal.nombre}» del ${day}.`, 'info');
  };

  const handleSendDayToMarket = (day: DayOfWeekKey) => {
    try {
      const result = StorageService.sendDayIngredientsToMarket(
        day,
        {
          targetListId: selectedTargetListId || undefined,
          category: 'Supermercado/Víveres',
        },
        appData
      );
      setAppData(result.updatedData);
      if (result.createdNewList) {
        setSelectedTargetListId(result.targetList.id);
      }

      if (result.addedItemsCount === 0 && result.skippedDuplicatesCount > 0) {
        showToast(
          `Todos los ingredientes del ${day} (${result.skippedDuplicatesCount}) ya estaban pendientes en «${result.targetList.nombre}».`,
          'info'
        );
      } else {
        showToast(
          `¡Listo! Se enviaron ${result.addedItemsCount} ingrediente(s) del ${day} a «${result.targetList.nombre}» (Supermercado/Víveres · Pendiente).`,
          'success'
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No se pudieron enviar los ingredientes al mercado.',
        'error'
      );
    }
  };

  const handleSendAllWeekToMarket = () => {
    try {
      const result = StorageService.sendAllWeekIngredientsToMarket(
        {
          targetListId: selectedTargetListId || undefined,
          category: 'Supermercado/Víveres',
        },
        appData
      );
      setAppData(result.updatedData);
      if (result.createdNewList) {
        setSelectedTargetListId(result.targetList.id);
      }

      showToast(
        `Se enviaron ${result.addedItemsCount} ingrediente(s) de la semana a «${result.targetList.nombre}».`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No hay ingredientes en la semana para enviar.',
        'error'
      );
    }
  };

  const handleLoadSampleMenu = () => {
    const updated = StorageService.loadSampleWeeklyMenu(appData);
    setAppData(updated);
    showToast(
      'Menú semanal de ejemplo cargado con éxito (Lunes a Domingo).',
      'success'
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabecera del Planificador de Menú Semanal */}
      <div className="bg-[var(--surface-subtle)] p-5 sm:p-6 rounded-2xl border border-[var(--border-hairline)] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--pink-light)] text-[var(--pink-primary)] text-[11px] font-bold uppercase tracking-wider">
            <Utensils className="w-3.5 h-3.5" />
            <span>Gestión del Hogar · Menú + Mercado</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            Planificador de Menú Semanal
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Organiza Desayuno, Almuerzo y Cena de Lunes a Domingo y envía los
            ingredientes de cualquier día directo a tu Lista de Mercado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Lista de Mercado destino */}
          <div className="flex items-center gap-2 bg-[var(--surface)] px-3 py-2 rounded-xl border border-[var(--border-input)]">
            <ShoppingBag className="w-4 h-4 text-[var(--pink-primary)] shrink-0" />
            <div className="text-xs">
              <label
                htmlFor="target-market-list"
                className="sr-only"
              >
                Lista de Mercado destino
              </label>
              <select
                id="target-market-list"
                value={selectedTargetListId}
                onChange={(e) => setSelectedTargetListId(e.target.value)}
                className="bg-transparent font-medium text-[var(--text-primary)] focus:outline-none text-xs"
              >
                {openMarketLists.length === 0 ? (
                  <option value="">
                    Crear lista abierta automáticamente
                  </option>
                ) : (
                  openMarketLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      Destino: {list.nombre} ({list.items.length} ítems)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {weekStats.totalMeals === 0 && (
            <button
              type="button"
              onClick={handleLoadSampleMenu}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
              <span>Cargar menú de ejemplo</span>
            </button>
          )}

          {weekStats.totalIngredients > 0 && (
            <button
              type="button"
              onClick={handleSendAllWeekToMarket}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--income-bg)] text-[var(--income-color)] hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
              title="Enviar todos los ingredientes de Lunes a Domingo a la Lista de Mercado"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                Enviar toda la semana ({weekStats.uniqueIngredientsCount})
              </span>
            </button>
          )}

          {onNavigateToSection && (
            <button
              type="button"
              onClick={() => onNavigateToSection('market')}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
              <span>Ver Lista de Mercado</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openAddMealModal('Lunes', 'Almuerzo')}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar comida</span>
          </button>
        </div>
      </div>

      {/* Leyenda de Tipos de Comida + Resumen Rápido */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-[var(--text-secondary)]">
            Tipos de comida:
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 font-medium">
            <Coffee className="w-3.5 h-3.5" />
            <span>Desayuno</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 font-medium">
            <Sun className="w-3.5 h-3.5" />
            <span>Almuerzo</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border border-indigo-500/30 font-medium">
            <Moon className="w-3.5 h-3.5" />
            <span>Cena</span>
          </span>
        </div>

        <div className="flex items-center gap-4 text-[var(--text-secondary)] font-mono-tabular">
          <span>
            Platos en la semana:{' '}
            <strong className="text-[var(--text-primary)]">
              {weekStats.totalMeals}
            </strong>
          </span>
          <span>
            Ingredientes únicos:{' '}
            <strong className="text-[var(--pink-primary)]">
              {weekStats.uniqueIngredientsCount}
            </strong>
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VISTA ESCRITORIO (PANTALLAS GRANDES): GRID DE 7 COLUMNAS            */}
      {/* =================================================================== */}
      <div className="hidden lg:grid lg:grid-cols-7 lg:gap-3.5 items-start">
        {DAYS_OF_WEEK.map((day) => {
          const meals = weeklyMenu.dias[day] || [];
          const dayIngredientsCount = meals.reduce(
            (acc, m) => acc + (m.ingredientes?.length || 0),
            0
          );

          return (
            <div
              key={day}
              className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] flex flex-col justify-between min-h-[430px] overflow-hidden shadow-2xs"
            >
              {/* Encabezado de la Columna del Día */}
              <div>
                <div className="p-3.5 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {day}
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)] font-mono-tabular">
                      {meals.length}{' '}
                      {meals.length === 1 ? 'comida' : 'comidas'} ·{' '}
                      {dayIngredientsCount} ingr.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddMealModal(day, 'Almuerzo')}
                    title={`Agregar comida al ${day}`}
                    className="p-1.5 rounded-lg bg-[var(--pink-light)] text-[var(--pink-primary)] hover:bg-[var(--pink-primary)] hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Lista de Comidas del Día */}
                <div className="p-3 space-y-2.5">
                  {meals.length === 0 ? (
                    <div className="py-10 px-2 text-center border border-dashed border-[var(--border-hairline)] rounded-xl">
                      <CalendarDays className="w-6 h-6 text-[var(--text-secondary)] opacity-40 mx-auto mb-1.5" />
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Sin comidas planificadas
                      </p>
                      <button
                        type="button"
                        onClick={() => openAddMealModal(day, 'Desayuno')}
                        className="mt-2 text-[11px] font-semibold text-[var(--pink-primary)] hover:underline"
                      >
                        + Añadir plato
                      </button>
                    </div>
                  ) : (
                    meals.map((meal) => {
                      const style = MEAL_TYPE_STYLES[meal.tipo];
                      const TypeIcon = style.Icon;
                      return (
                        <div
                          key={meal.id}
                          className={`p-3 rounded-xl border transition-all space-y-2 ${style.cardClass}`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${style.badgeClass}`}
                            >
                              <TypeIcon className="w-3 h-3" />
                              <span>{meal.tipo}</span>
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditMealModal(day, meal)}
                                title="Editar comida"
                                className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMeal(day, meal)}
                                title="Eliminar comida"
                                className="p-1 rounded-md text-[var(--expense-color)] hover:bg-black/5 dark:hover:bg-white/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                            {meal.nombre}
                          </p>

                          {meal.ingredientes && meal.ingredientes.length > 0 ? (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {meal.ingredientes.map((ing, i) => (
                                <span
                                  key={`${meal.id}_ing_${i}`}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.chipClass}`}
                                >
                                  {ing}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] italic text-[var(--text-secondary)]">
                              Sin ingredientes listados
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pie de Columna: Botón "Enviar ingredientes al Mercado" */}
              <div className="p-3 border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60">
                <button
                  type="button"
                  disabled={dayIngredientsCount === 0}
                  onClick={() => handleSendDayToMarket(day)}
                  className="w-full py-2 px-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                  title={`Enviar los ${dayIngredientsCount} ingredientes del ${day} a la Lista de Mercado`}
                >
                  <Send className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    Enviar ingredientes al Mercado
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* VISTA MÓVIL (MOBILE-FIRST): ACORDEÓN VERTICAL POR DÍA DE LA SEMANA  */}
      {/* =================================================================== */}
      <div className="lg:hidden space-y-3">
        {DAYS_OF_WEEK.map((day) => {
          const meals = weeklyMenu.dias[day] || [];
          const dayIngredientsCount = meals.reduce(
            (acc, m) => acc + (m.ingredientes?.length || 0),
            0
          );
          const isExpanded = expandedMobileDay === day;

          return (
            <div
              key={day}
              className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden"
            >
              {/* Cabecera del Acordeón */}
              <button
                type="button"
                onClick={() =>
                  setExpandedMobileDay((prev) => (prev === day ? null : day))
                }
                className="w-full px-4 py-3.5 bg-[var(--surface-subtle)] flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center font-bold text-xs shrink-0">
                    {day.slice(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {day}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {meals.length}{' '}
                      {meals.length === 1 ? 'comida' : 'comidas'} ·{' '}
                      {dayIngredientsCount} ingrediente(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                  )}
                </div>
              </button>

              {/* Contenido Desplegable del Día */}
              {isExpanded && (
                <div className="p-4 space-y-3 border-t border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openAddMealModal(day, 'Almuerzo')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--pink-light)] text-[var(--pink-primary)] inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar plato al {day}</span>
                    </button>

                    <button
                      type="button"
                      disabled={dayIngredientsCount === 0}
                      onClick={() => handleSendDayToMarket(day)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--pink-primary)] text-white disabled:opacity-40 inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar ingredientes al Mercado</span>
                    </button>
                  </div>

                  {meals.length === 0 ? (
                    <div className="p-5 text-center rounded-xl border border-dashed border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                      No hay comidas registradas para el {day}.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {meals.map((meal) => {
                        const style = MEAL_TYPE_STYLES[meal.tipo];
                        const TypeIcon = style.Icon;
                        return (
                          <div
                            key={meal.id}
                            className={`p-3.5 rounded-xl border space-y-2 ${style.cardClass}`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${style.badgeClass}`}
                              >
                                <TypeIcon className="w-3 h-3" />
                                <span>{meal.tipo}</span>
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditMealModal(day, meal)}
                                  className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMeal(day, meal)}
                                  className="p-1.5 text-[var(--expense-color)]"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <h4 className="text-sm font-bold text-[var(--text-primary)]">
                              {meal.nombre}
                            </h4>

                            {meal.ingredientes && meal.ingredientes.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {meal.ingredientes.map((ing, i) => (
                                  <span
                                    key={`${meal.id}_mob_ing_${i}`}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${style.chipClass}`}
                                  >
                                    {ing}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* MODAL PARA AGREGAR O EDITAR UNA COMIDA EN CUALQUIER DÍA            */}
      {/* =================================================================== */}
      {mealModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setMealModalOpen(false)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {editingMealId ? 'Editar comida' : 'Agregar comida al menú'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Define el plato y sus ingredientes para enviarlos al mercado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMealModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMealSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Día de la semana
                  </label>
                  <select
                    value={modalDay}
                    onChange={(e) =>
                      setModalDay(e.target.value as DayOfWeekKey)
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-input)] text-[var(--text-primary)]"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Tipo de comida
                  </label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value as MealType)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-input)] text-[var(--text-primary)]"
                  >
                    <option value="Desayuno">☀️ Desayuno</option>
                    <option value="Almuerzo">🍽️ Almuerzo</option>
                    <option value="Cena">🌙 Cena</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Nombre del plato
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pollo a la plancha con arroz y ensalada"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-input)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Ingredientes (se enviarán a Supermercado/Víveres)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escribe separados por coma (ej. Pollo, Arroz, Lechuga) y pulsa +"
                    value={ingredientDraft}
                    onChange={(e) => setIngredientDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDraftIngredients();
                      }
                    }}
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-input)] text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddDraftIngredients}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] hover:bg-[var(--pink-primary)] hover:text-white transition-colors"
                  >
                    + Añadir
                  </button>
                </div>

                {ingredientsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                    {ingredientsList.map((ing, idx) => (
                      <span
                        key={`chip_${idx}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      >
                        <span>{ing}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredientChip(idx)}
                          className="text-[var(--text-secondary)] hover:text-[var(--expense-color)]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMealModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)]"
                >
                  {editingMealId ? 'Guardar cambios' : 'Guardar comida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
