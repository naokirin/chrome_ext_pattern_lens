import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BLOCK_BOUNDARY_MARKER, createVirtualTextAndMap } from '~/lib/search/virtualText';
import { cleanupDOM, visualizeBoundaries } from '../../../helpers/dom-helpers.js';

describe('virtualText', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('createVirtualTextAndMap', () => {
    it('シンプルなインライン要素から仮想テキストを作成できる', () => {
      document.body.innerHTML = '<span>Hello</span><span>World</span>';

      const { virtualText, charMap } = createVirtualTextAndMap();

      // インライン要素間には境界マーカーがない
      expect(virtualText).toBe('HelloWorld');
      expect(charMap.length).toBe(10);
    });

    it('ブロック要素間に境界マーカーを挿入する', () => {
      document.body.innerHTML = '<div>Hello</div><div>World</div>';

      const { virtualText, charMap } = createVirtualTextAndMap();

      // ブロック要素間には境界マーカーがある
      expect(virtualText).toBe(`Hello${BLOCK_BOUNDARY_MARKER}World`);
      expect(charMap.length).toBe(11); // 5 + 1 (boundary) + 5

      // 境界マーカーのcharMapを確認
      const boundaryIndex = charMap.findIndex((item) => item.type === 'block-boundary');
      expect(boundaryIndex).toBe(5);
      expect(charMap[boundaryIndex].node).toBe(null);
    });

    it('同じブロック内のインライン要素には境界マーカーがない', () => {
      document.body.innerHTML = '<div><span>Hello</span><span>World</span></div>';

      const { virtualText } = createVirtualTextAndMap();

      // 同じブロック内なので境界マーカーなし
      expect(virtualText).toBe('HelloWorld');
      expect(visualizeBoundaries(virtualText)).toBe('HelloWorld');
    });

    it('インライン要素間の空白を保持する', () => {
      document.body.innerHTML = '<div><span>Hello</span> <span>World</span></div>';

      const { virtualText } = createVirtualTextAndMap();

      // 空白テキストノードが保持される
      expect(virtualText).toBe('Hello World');
      expect(visualizeBoundaries(virtualText)).toBe('Hello World');
    });

    it('段落要素間に境界マーカーを挿入する', () => {
      document.body.innerHTML = '<p>Lorem ipsum</p><p>dolor sit</p>';

      const { virtualText } = createVirtualTextAndMap();

      // 段落間に境界マーカー
      expect(virtualText).toBe(`Lorem ipsum${BLOCK_BOUNDARY_MARKER}dolor sit`);
      expect(visualizeBoundaries(virtualText)).toBe('Lorem ipsum[BOUNDARY]dolor sit');
    });

    it('見出しと段落の間に境界マーカーを挿入する', () => {
      document.body.innerHTML = '<h4>Important Note</h4><p>This is critical</p>';

      const { virtualText } = createVirtualTextAndMap();

      // 見出しと段落間に境界マーカー
      expect(virtualText).toBe(`Important Note${BLOCK_BOUNDARY_MARKER}This is critical`);
    });

    it('リスト項目間に境界マーカーを挿入する', () => {
      document.body.innerHTML = `
        <ul>
          <li>First</li>
          <li>Second</li>
          <li>Third</li>
        </ul>
      `;

      const { virtualText } = createVirtualTextAndMap();

      // リスト項目はブロックレベルなので境界マーカーがある
      const visible = visualizeBoundaries(virtualText);
      expect(visible).toContain('First');
      expect(visible).toContain('Second');
      expect(visible).toContain('Third');
      expect(visible).toContain('[BOUNDARY]');
    });

    it('テーブルセル間に境界マーカーを挿入する', () => {
      document.body.innerHTML = `
        <table>
          <tr>
            <td>Cell</td>
            <td>One</td>
            <td>Two</td>
          </tr>
        </table>
      `;

      const { virtualText } = createVirtualTextAndMap();

      // テーブルセルはブロックレベルなので境界マーカーがある
      const visible = visualizeBoundaries(virtualText);
      expect(visible).toContain('Cell');
      expect(visible).toContain('One');
      expect(visible).toContain('Two');
      expect(visible).toContain('[BOUNDARY]');
    });

    it('空白のみのテキストノードを保持する', () => {
      document.body.innerHTML = '<div>   </div><div>Text</div>';

      const { virtualText } = createVirtualTextAndMap();

      // 空白のみのテキストノードが保持され、ブロック間に境界マーカー
      expect(virtualText).toBe(`   ${BLOCK_BOUNDARY_MARKER}Text`);
    });

    it('非表示要素をスキップする', () => {
      document.body.innerHTML = '<div style="display: none;">Hidden</div><div>Visible</div>';

      const { virtualText } = createVirtualTextAndMap();

      // 非表示要素はスキップされる
      expect(virtualText).toBe('Visible');
    });

    it('visibility: hiddenの要素をスキップする', () => {
      document.body.innerHTML = '<div style="visibility: hidden;">Hidden</div><div>Visible</div>';

      const { virtualText } = createVirtualTextAndMap();

      // visibility: hiddenの要素もスキップされる
      expect(virtualText).toBe('Visible');
    });

    it('インライン要素とブロック要素の混合を処理する', () => {
      document.body.innerHTML =
        '<div><span>git</span><span>commit</span><span>-m</span></div><div>"message"</div>';

      const { virtualText } = createVirtualTextAndMap();

      // 同じブロック内のインライン要素: 境界マーカーなし
      // 異なるブロック要素: 境界マーカーあり
      const visible = visualizeBoundaries(virtualText);
      expect(visible).toBe('gitcommit-m[BOUNDARY]"message"');
    });

    it('文字をDOMノードに正しくマッピングする', () => {
      document.body.innerHTML = '<div>AB</div><div>CD</div>';

      const { charMap } = createVirtualTextAndMap();

      // 文字マッピングを確認
      expect(charMap[0].node.nodeValue).toBe('AB');
      expect(charMap[0].offset).toBe(0);
      expect(charMap[1].node.nodeValue).toBe('AB');
      expect(charMap[1].offset).toBe(1);

      // 境界マーカー
      expect(charMap[2].type).toBe('block-boundary');
      expect(charMap[2].node).toBe(null);

      // 2番目のブロック
      expect(charMap[3].node.nodeValue).toBe('CD');
      expect(charMap[3].offset).toBe(0);
      expect(charMap[4].node.nodeValue).toBe('CD');
      expect(charMap[4].offset).toBe(1);
    });

    it('SCRIPTタグをスキップする', () => {
      document.body.innerHTML =
        '<div>Hello</div><script>console.log("test");</script><div>World</div>';

      const { virtualText } = createVirtualTextAndMap();

      // SCRIPTタグの内容はスキップされる
      expect(virtualText).toBe(`Hello${BLOCK_BOUNDARY_MARKER}World`);
    });

    it('STYLEタグをスキップする', () => {
      document.body.innerHTML =
        '<div>Hello</div><style>.test { color: red; }</style><div>World</div>';

      const { virtualText } = createVirtualTextAndMap();

      // STYLEタグの内容はスキップされる
      expect(virtualText).toBe(`Hello${BLOCK_BOUNDARY_MARKER}World`);
    });

    it('オーバーレイコンテナをスキップする', () => {
      document.body.innerHTML = '<div>Hello</div>';
      const overlayContainer = document.createElement('div');
      overlayContainer.id = 'pattern-lens-overlay-container';
      overlayContainer.textContent = 'Overlay content';
      document.body.appendChild(overlayContainer);
      document.body.innerHTML += '<div>World</div>';

      const { virtualText } = createVirtualTextAndMap();

      // オーバーレイコンテナの内容はスキップされる
      expect(virtualText).toBe(`Hello${BLOCK_BOUNDARY_MARKER}World`);
    });

    it('空のテキストノードをスキップする', () => {
      document.body.innerHTML = '<div></div><div>Text</div>';

      const { virtualText } = createVirtualTextAndMap();

      // 空のテキストノードはスキップされる
      expect(virtualText).toBe('Text');
    });

    it('ネストされたブロック要素を正しく処理する', () => {
      document.body.innerHTML = '<div><div>Inner</div></div><div>Outer</div>';

      const { virtualText } = createVirtualTextAndMap();

      // ネストされたブロック要素も正しく処理される
      const visible = visualizeBoundaries(virtualText);
      expect(visible).toContain('Inner');
      expect(visible).toContain('Outer');
      expect(visible).toContain('[BOUNDARY]');
    });

    it('連続するブロック要素間に1つの境界マーカーのみを挿入する', () => {
      document.body.innerHTML = '<div>A</div><div>B</div><div>C</div>';

      const { virtualText } = createVirtualTextAndMap();

      // 連続するブロック要素間にはそれぞれ境界マーカーがある
      const boundaries = virtualText.split(BLOCK_BOUNDARY_MARKER);
      expect(boundaries.length).toBe(3);
      expect(boundaries[0]).toBe('A');
      expect(boundaries[1]).toBe('B');
      expect(boundaries[2]).toBe('C');
    });
  });
});
