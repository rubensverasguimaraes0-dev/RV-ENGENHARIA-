-- =============================================================================
-- RV Engenharia — carga inicial
-- Regra 11.6: todo valor de referencia mora em parametros, nunca no codigo.
-- Valores monetarios em parametros sao gravados em CENTAVOS.
-- =============================================================================

insert into public.parametros (chave, valor, descricao) values
  -- Empresa (rodape de todo documento — spec 4.17)
  ('empresa_nome',        'RV Engenharia',                          'Nome da empresa'),
  ('empresa_endereco',    'Av. Zequinha Freire, 3531 — Teresina/PI', 'Endereco do rodape'),
  ('empresa_telefone',    '(86) 99437-9883',                        'Telefone do rodape'),
  ('empresa_email',       'rvengenhariathe@gmail.com',              'E-mail do rodape'),
  ('empresa_instagram',   '@rvengenhariathe',                       'Instagram do rodape'),
  ('responsavel_nome',    'Rubens Veras Guimaraes',                 'Responsavel tecnico'),
  ('responsavel_titulo',  'Eng. Civil',                             'Titulo do responsavel'),
  ('responsavel_crea',    'CREA-PI 35900',                          'Registro do responsavel'),
  ('empresa_logo_url',    '',                                       'URL da logo no topo dos documentos'),

  -- Obras civis
  ('valor_quentinha_padrao',   '1800', 'Valor unitario padrao da quentinha, em centavos'),
  ('faixas_quentinha',         '[1500,1800,2200]', 'Faixas de valor de quentinha ja usadas (centavos)'),
  ('percentual_meia_diaria',   '0.5',  'Meia diaria: fracao do valor cheio (spec 14.1)'),
  ('percentual_rateio_parceiro','0.5', 'Rateio padrao do resultado com o parceiro (spec 14.2)'),
  ('base_rateio_parceiro',     'resultado_total', 'resultado_total | margem_mao_obra (spec 14.2)'),
  ('sabado_sem_quentinha',     'true', 'Sabado: diaria integral e sem quentinha'),

  -- Orcamento
  ('margem_padrao',  '0.30', 'Margem padrao sobre o custo'),
  ('bdi_padrao',     '0.25', 'BDI padrao do orcamento completo'),

  -- Energia solar (spec 5.3)
  ('solar_hsp',                   '5.4',  'HSP de Teresina em kWh/m2.dia'),
  ('solar_performance_ratio',     '0.78', 'Performance ratio do sistema'),
  ('solar_disp_monofasica',       '30',   'Custo de disponibilidade monofasico, em kWh'),
  ('solar_disp_bifasica',         '50',   'Custo de disponibilidade bifasico, em kWh'),
  ('solar_disp_trifasica',        '100',  'Custo de disponibilidade trifasico, em kWh'),
  ('solar_degradacao_anual',      '0.0055', 'Degradacao anual dos modulos'),
  ('solar_fator_inversor',        '0.80', 'Fator de dimensionamento do inversor (0,75 a 1,00)'),
  ('solar_percentual_fio_b',      '{"2023":0.15,"2024":0.30,"2025":0.45,"2026":0.60,"2027":0.75,"2028":0.90}',
                                          'Percentual do Fio B por ano — Lei 14.300'),
  ('solar_tarifa_fio_b',          '30',   'Tarifa do Fio B em centavos por kWh'),
  ('solar_projeto_art',           '150000', 'Projeto, ART e homologacao, em centavos'),
  ('solar_mao_obra_kwp',          '50000', 'Mao de obra de instalacao em centavos por kWp'),
  ('solar_margem',                '0.30', 'Margem da proposta solar — nunca aparece no documento'),
  ('solar_concessionaria_padrao', 'Equatorial Piaui', 'Concessionaria padrao'),

  -- Textos padrao das condicoes comerciais (spec 8)
  ('texto_prazo_execucao', 'Prazo de execucao a combinar apos a assinatura do contrato.', 'Texto padrao de prazo'),
  ('texto_validade',       'Proposta valida por 15 dias.', 'Texto padrao de validade'),
  ('texto_garantia',       'Garantia de 5 anos para os servicos executados, conforme o Codigo Civil.', 'Texto padrao de garantia'),
  ('texto_nao_incluso',    'Nao estao inclusos: itens nao descritos nesta proposta.', 'Texto padrao do que nao esta incluso'),
  ('cotacao_dias_alerta',  '30', 'Dias a partir dos quais a cotacao e sinalizada como antiga')
on conflict (chave) do nothing;

-- Fornecedores ja usados, para autocompletar na tela de nota (spec 4.6)
insert into public.fornecedores (nome, categoria) values
  ('J. Monte', 'material'),
  ('Baratao das Construcoes', 'material'),
  ('Engecopi', 'material'),
  ('PH Deposito', 'material'),
  ('Hidroeletrica Engenharia', 'material'),
  ('Hidroeletrica Center', 'material'),
  ('Comercial Barroso', 'material'),
  ('Kalfort', 'material'),
  ('Comercial Constru Leste', 'material'),
  ('Solucao em Materiais de Construcao', 'material'),
  ('B F Eletrica', 'material'),
  ('Mestre da Obra', 'locacao'),
  ('Sul Entulho', 'cacamba'),
  ('L & A Parafusos', 'material'),
  ('JN Construcoes', 'material'),
  ('M & W Materiais', 'material'),
  ('Fix Ferramentas', 'material'),
  ('Alex Construcoes', 'material'),
  ('Nara L L Silva', 'material'),
  ('Ponto do Gesso', 'material'),
  ('Piaui Materiais', 'material'),
  ('Ferroleste', 'material'),
  ('G C Comercio e Servicos', 'material'),
  ('Barroso Sao Cristovao', 'material')
on conflict do nothing;
